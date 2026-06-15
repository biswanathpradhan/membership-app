import prisma from "~/db.server";
import { logAuditEvent, generateReferralCode, generateSlug } from "~/lib/security";
import { MEMBER_STATUSES, MEMBER_TAG_PREFIX } from "~/lib/constants";
import type { membershipPlanSchema } from "~/lib/validation";
import type { z } from "zod";

type PlanInput = z.infer<typeof membershipPlanSchema>;

export async function listPlans(shopId: string) {
  return prisma.membershipPlan.findMany({
    where: { shopId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    include: { _count: { select: { members: true } } },
  });
}

export async function getPlan(shopId: string, planId: string) {
  return prisma.membershipPlan.findFirst({
    where: { id: planId, shopId },
    include: { _count: { select: { members: true } } },
  });
}

export async function createPlan(
  shopId: string,
  data: PlanInput,
  actor?: string,
) {
  const slug = data.slug || generateSlug(data.name);
  const maxOrder = await prisma.membershipPlan.aggregate({
    where: { shopId },
    _max: { sortOrder: true },
  });

  const plan = await prisma.membershipPlan.create({
    data: {
      shopId,
      name: data.name,
      description: data.description,
      slug,
      price: data.price,
      currency: data.currency,
      billingInterval: data.billingInterval,
      trialDays: data.trialDays,
      discountPercent: data.discountPercent,
      freeShipping: data.freeShipping,
      earlyAccess: data.earlyAccess,
      exclusiveAccess: data.exclusiveAccess,
      loyaltyMultiplier: data.loyaltyMultiplier,
      maxMembers: data.maxMembers ?? null,
      benefits: JSON.stringify(data.benefits),
      color: data.color,
      isActive: data.isActive,
      sortOrder: (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });

  await logAuditEvent({
    shopId,
    action: "create",
    entity: "membership_plan",
    entityId: plan.id,
    actor,
    details: { name: plan.name },
  });

  return plan;
}

export async function updatePlan(
  shopId: string,
  planId: string,
  data: Partial<PlanInput>,
  actor?: string,
) {
  const plan = await prisma.membershipPlan.update({
    where: { id: planId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.slug !== undefined && { slug: data.slug }),
      ...(data.price !== undefined && { price: data.price }),
      ...(data.billingInterval !== undefined && { billingInterval: data.billingInterval }),
      ...(data.trialDays !== undefined && { trialDays: data.trialDays }),
      ...(data.discountPercent !== undefined && { discountPercent: data.discountPercent }),
      ...(data.freeShipping !== undefined && { freeShipping: data.freeShipping }),
      ...(data.earlyAccess !== undefined && { earlyAccess: data.earlyAccess }),
      ...(data.exclusiveAccess !== undefined && { exclusiveAccess: data.exclusiveAccess }),
      ...(data.loyaltyMultiplier !== undefined && { loyaltyMultiplier: data.loyaltyMultiplier }),
      ...(data.maxMembers !== undefined && { maxMembers: data.maxMembers }),
      ...(data.benefits !== undefined && { benefits: JSON.stringify(data.benefits) }),
      ...(data.color !== undefined && { color: data.color }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
  });

  await logAuditEvent({
    shopId,
    action: "update",
    entity: "membership_plan",
    entityId: planId,
    actor,
    details: data as Record<string, unknown>,
  });

  return plan;
}

export async function deletePlan(shopId: string, planId: string, actor?: string) {
  const memberCount = await prisma.member.count({
    where: { planId, status: MEMBER_STATUSES.ACTIVE },
  });

  if (memberCount > 0) {
    throw new Error(`Cannot delete plan with ${memberCount} active members`);
  }

  await prisma.membershipPlan.delete({ where: { id: planId } });

  await logAuditEvent({
    shopId,
    action: "delete",
    entity: "membership_plan",
    entityId: planId,
    actor,
  });
}

export async function listMembers(
  shopId: string,
  options: {
    status?: string;
    planId?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {},
) {
  const { status, planId, search, page = 1, limit = 25 } = options;
  const where: Record<string, unknown> = { shopId };

  if (status) where.status = status;
  if (planId) where.planId = planId;
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { firstName: { contains: search } },
      { lastName: { contains: search } },
    ];
  }

  const [members, total] = await Promise.all([
    prisma.member.findMany({
      where,
      include: { plan: true },
      orderBy: { joinedAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.member.count({ where }),
  ]);

  return { members, total, page, totalPages: Math.ceil(total / limit) };
}

export async function getMember(shopId: string, memberId: string) {
  return prisma.member.findFirst({
    where: { id: memberId, shopId },
    include: {
      plan: true,
      loyaltyTransactions: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      referralsMade: { take: 10, orderBy: { createdAt: "desc" } },
    },
  });
}

export async function enrollMember(params: {
  shopId: string;
  shopifyCustomerId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  planId?: string;
  actor?: string;
}) {
  const existing = await prisma.member.findUnique({
    where: {
      shopId_shopifyCustomerId: {
        shopId: params.shopId,
        shopifyCustomerId: params.shopifyCustomerId,
      },
    },
  });

  if (existing) {
    if (existing.status === MEMBER_STATUSES.CANCELLED) {
      return prisma.member.update({
        where: { id: existing.id },
        data: {
          status: MEMBER_STATUSES.ACTIVE,
          planId: params.planId,
          cancelledAt: null,
        },
      });
    }
    return existing;
  }

  let referralCode = generateReferralCode(params.firstName);
  let attempts = 0;
  while (attempts < 5) {
    const collision = await prisma.member.findUnique({
      where: { shopId_referralCode: { shopId: params.shopId, referralCode } },
    });
    if (!collision) break;
    referralCode = generateReferralCode(params.firstName);
    attempts++;
  }

  const member = await prisma.member.create({
    data: {
      shopId: params.shopId,
      shopifyCustomerId: params.shopifyCustomerId,
      email: params.email,
      firstName: params.firstName,
      lastName: params.lastName,
      planId: params.planId,
      referralCode,
      status: MEMBER_STATUSES.ACTIVE,
    },
  });

  const loyaltyProgram = await prisma.loyaltyProgram.findUnique({
    where: { shopId: params.shopId },
  });

  if (loyaltyProgram?.isActive && loyaltyProgram.signupBonus > 0) {
    await awardLoyaltyPoints({
      shopId: params.shopId,
      memberId: member.id,
      points: loyaltyProgram.signupBonus,
      type: "bonus",
      description: "Welcome bonus",
    });
  }

  await logAuditEvent({
    shopId: params.shopId,
    action: "enroll",
    entity: "member",
    entityId: member.id,
    actor: params.actor,
    details: { email: params.email, planId: params.planId },
  });

  return member;
}

export async function updateMember(
  shopId: string,
  memberId: string,
  data: {
    planId?: string | null;
    status?: string;
    notes?: string;
    loyaltyPoints?: number;
  },
  actor?: string,
) {
  const updateData: Record<string, unknown> = {};

  if (data.planId !== undefined) updateData.planId = data.planId;
  if (data.notes !== undefined) updateData.notes = data.notes;
  if (data.loyaltyPoints !== undefined) updateData.loyaltyPoints = data.loyaltyPoints;

  if (data.status) {
    updateData.status = data.status;
    if (data.status === MEMBER_STATUSES.CANCELLED) {
      updateData.cancelledAt = new Date();
    } else if (data.status === MEMBER_STATUSES.PAUSED) {
      updateData.pausedAt = new Date();
    }
  }

  const member = await prisma.member.update({
    where: { id: memberId },
    data: updateData,
  });

  await logAuditEvent({
    shopId,
    action: "update",
    entity: "member",
    entityId: memberId,
    actor,
    details: data,
  });

  return member;
}

export async function awardLoyaltyPoints(params: {
  shopId: string;
  memberId: string;
  points: number;
  type: string;
  description?: string;
  orderId?: string;
}) {
  const program = await prisma.loyaltyProgram.findUnique({
    where: { shopId: params.shopId },
  });
  if (!program?.isActive) return null;

  const member = await prisma.member.findUnique({
    where: { id: params.memberId },
  });
  if (!member) return null;

  const newBalance = member.loyaltyPoints + params.points;

  const [transaction] = await Promise.all([
    prisma.loyaltyTransaction.create({
      data: {
        programId: program.id,
        memberId: params.memberId,
        type: params.type,
        points: params.points,
        balance: newBalance,
        description: params.description,
        orderId: params.orderId,
      },
    }),
    prisma.member.update({
      where: { id: params.memberId },
      data: { loyaltyPoints: newBalance },
    }),
  ]);

  return transaction;
}

export function getMemberShopifyTags(planSlug?: string | null): string[] {
  const tags = [`${MEMBER_TAG_PREFIX}:member`];
  if (planSlug) tags.push(`${MEMBER_TAG_PREFIX}:${planSlug}`);
  return tags;
}
