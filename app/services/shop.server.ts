import prisma from "~/db.server";
import type { Shop } from "@prisma/client";

export async function getOrCreateShop(shopDomain: string): Promise<Shop> {
  let shop = await prisma.shop.findUnique({ where: { shopDomain } });

  if (!shop) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    shop = await prisma.shop.create({
      data: {
        shopDomain,
        billingPlan: "trial",
        billingStatus: "active",
        trialEndsAt,
      },
    });

    await prisma.loyaltyProgram.create({
      data: { shopId: shop.id },
    });
  }

  return shop;
}

export async function getShopSettings(shopId: string): Promise<Record<string, unknown>> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });
  if (!shop) return {};
  try {
    return JSON.parse(shop.settings) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function updateShopSettings(
  shopId: string,
  settings: Record<string, unknown>,
): Promise<void> {
  const current = await getShopSettings(shopId);
  await prisma.shop.update({
    where: { id: shopId },
    data: { settings: JSON.stringify({ ...current, ...settings }) },
  });
}

export async function getDashboardStats(shopId: string) {
  const [
    totalMembers,
    activeMembers,
    totalPlans,
    activePlans,
    recentMembers,
    loyaltyProgram,
    referrals,
  ] = await Promise.all([
    prisma.member.count({ where: { shopId } }),
    prisma.member.count({ where: { shopId, status: "active" } }),
    prisma.membershipPlan.count({ where: { shopId } }),
    prisma.membershipPlan.count({ where: { shopId, isActive: true } }),
    prisma.member.findMany({
      where: { shopId },
      orderBy: { joinedAt: "desc" },
      take: 5,
      include: { plan: true },
    }),
    prisma.loyaltyProgram.findUnique({ where: { shopId } }),
    prisma.referral.count({
      where: { shopId, status: "completed" },
    }),
  ]);

  const membersByPlan = await prisma.member.groupBy({
    by: ["planId"],
    where: { shopId, status: "active" },
    _count: true,
  });

  const plans = await prisma.membershipPlan.findMany({
    where: { shopId },
    select: { id: true, name: true, price: true, color: true },
  });

  const planMap = new Map(plans.map((p) => [p.id, p]));
  const revenueByPlan = membersByPlan.map((g) => ({
    plan: g.planId ? planMap.get(g.planId) : null,
    count: g._count,
    mrr: g.planId ? (planMap.get(g.planId)?.price || 0) * g._count : 0,
  }));

  const totalMrr = revenueByPlan.reduce((sum, r) => sum + r.mrr, 0);
  const lifetimeSpend = await prisma.member.aggregate({
    where: { shopId },
    _sum: { lifetimeSpend: true },
  });

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const newMembersLast30Days = await prisma.member.count({
    where: { shopId, joinedAt: { gte: thirtyDaysAgo } },
  });

  const cancelledLast30Days = await prisma.member.count({
    where: {
      shopId,
      status: "cancelled",
      cancelledAt: { gte: thirtyDaysAgo },
    },
  });

  const churnRate =
    activeMembers > 0
      ? ((cancelledLast30Days / (activeMembers + cancelledLast30Days)) * 100).toFixed(1)
      : "0.0";

  return {
    totalMembers,
    activeMembers,
    totalPlans,
    activePlans,
    totalMrr,
    lifetimeRevenue: lifetimeSpend._sum.lifetimeSpend || 0,
    newMembersLast30Days,
    churnRate,
    completedReferrals: referrals,
    loyaltyActive: loyaltyProgram?.isActive ?? false,
    recentMembers,
    revenueByPlan,
  };
}
