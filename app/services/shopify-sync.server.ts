import prisma from "~/db.server";
import { logAuditEvent } from "~/lib/security";

interface AdminGraphQL {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
}

export async function syncMemberTags(
  admin: AdminGraphQL,
  shopifyCustomerId: string,
  tags: string[],
): Promise<void> {
  const gid = shopifyCustomerId.startsWith("gid://")
    ? shopifyCustomerId
    : `gid://shopify/Customer/${shopifyCustomerId}`;

  await admin.graphql(
    `#graphql
    mutation customerUpdate($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer { id tags }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: {
          id: gid,
          tags,
        },
      },
    },
  );
}

export async function createMemberDiscount(
  admin: AdminGraphQL,
  params: {
    title: string;
    code: string;
    percentage: number;
    planId: string;
  },
): Promise<string | null> {
  const response = await admin.graphql(
    `#graphql
    mutation discountCodeBasicCreate($basicCodeDiscount: DiscountCodeBasicInput!) {
      discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
        codeDiscountNode { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        basicCodeDiscount: {
          title: params.title,
          code: params.code,
          startsAt: new Date().toISOString(),
          customerGets: {
            value: { percentage: params.percentage / 100 },
            items: { all: true },
          },
          customerSelection: { all: true },
        },
      },
    },
  );

  const json = await response.json();
  return json.data?.discountCodeBasicCreate?.codeDiscountNode?.id ?? null;
}

export async function syncCustomerMetafields(
  admin: AdminGraphQL,
  shopifyCustomerId: string,
  metafields: Array<{ namespace: string; key: string; value: string; type: string }>,
): Promise<void> {
  const gid = shopifyCustomerId.startsWith("gid://")
    ? shopifyCustomerId
    : `gid://shopify/Customer/${shopifyCustomerId}`;

  await admin.graphql(
    `#graphql
    mutation customerUpdate($input: CustomerInput!) {
      customerUpdate(input: $input) {
        customer { id }
        userErrors { field message }
      }
    }`,
    {
      variables: {
        input: {
          id: gid,
          metafields,
        },
      },
    },
  );
}

export async function handleOrderCreated(
  shopId: string,
  order: {
    id: string;
    customer?: { id: string; email: string; first_name?: string; last_name?: string } | null;
    total_price: string;
    line_items?: Array<{ product_id: number }>;
  },
) {
  if (!order.customer?.id) return;

  const customerId = String(order.customer.id);
  const member = await prisma.member.findUnique({
    where: {
      shopId_shopifyCustomerId: { shopId, shopifyCustomerId: customerId },
    },
    include: { plan: true },
  });

  const orderTotal = parseFloat(order.total_price);

  if (member) {
    await prisma.member.update({
      where: { id: member.id },
      data: { lifetimeSpend: { increment: orderTotal } },
    });

    const program = await prisma.loyaltyProgram.findUnique({ where: { shopId } });
    if (program?.isActive) {
      const multiplier = member.plan?.loyaltyMultiplier ?? 1;
      const points = Math.floor(orderTotal * program.pointsPerDollar * multiplier);

      if (points > 0) {
        const { awardLoyaltyPoints } = await import("./membership.server");
        await awardLoyaltyPoints({
          shopId,
          memberId: member.id,
          points,
          type: "earn",
          description: `Order #${order.id}`,
          orderId: order.id,
        });
      }
    }
  } else {
    const settings = await prisma.shop.findUnique({ where: { id: shopId } });
    if (settings) {
      try {
        const parsed = JSON.parse(settings.settings) as Record<string, unknown>;
        if (parsed.autoEnrollOnPurchase) {
          const { enrollMember } = await import("./membership.server");
          await enrollMember({
            shopId,
            shopifyCustomerId: customerId,
            email: order.customer.email,
            firstName: order.customer.first_name,
            lastName: order.customer.last_name,
          });
        }
      } catch {
        // ignore parse errors
      }
    }
  }
}

export async function handleCustomerCreated(
  shopId: string,
  customer: {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  },
) {
  const existing = await prisma.member.findUnique({
    where: {
      shopId_shopifyCustomerId: {
        shopId,
        shopifyCustomerId: String(customer.id),
      },
    },
  });

  if (!existing) {
    const settings = await prisma.shop.findUnique({ where: { id: shopId } });
    if (settings) {
      try {
        const parsed = JSON.parse(settings.settings) as Record<string, unknown>;
        if (parsed.autoEnrollOnPurchase) {
          const { enrollMember } = await import("./membership.server");
          await enrollMember({
            shopId,
            shopifyCustomerId: String(customer.id),
            email: customer.email,
            firstName: customer.first_name,
            lastName: customer.last_name,
          });
        }
      } catch {
        // ignore
      }
    }
  }
}

export async function redactCustomerData(shopId: string, customerId: string) {
  const member = await prisma.member.findUnique({
    where: {
      shopId_shopifyCustomerId: { shopId, shopifyCustomerId: customerId },
    },
  });

  if (member) {
    await prisma.loyaltyTransaction.deleteMany({ where: { memberId: member.id } });
    await prisma.referral.deleteMany({
      where: { OR: [{ referrerId: member.id }, { referredId: member.id }] },
    });
    await prisma.member.delete({ where: { id: member.id } });

    await logAuditEvent({
      shopId,
      action: "gdpr_redact",
      entity: "member",
      entityId: member.id,
      details: { customerId },
    });
  }
}

export async function exportCustomerData(shopId: string, customerId: string) {
  const member = await prisma.member.findUnique({
    where: {
      shopId_shopifyCustomerId: { shopId, shopifyCustomerId: customerId },
    },
    include: {
      plan: true,
      loyaltyTransactions: true,
      referralsMade: true,
    },
  });

  return member
    ? {
        email: member.email,
        firstName: member.firstName,
        lastName: member.lastName,
        status: member.status,
        plan: member.plan?.name,
        loyaltyPoints: member.loyaltyPoints,
        joinedAt: member.joinedAt,
        transactions: member.loyaltyTransactions,
        referrals: member.referralsMade,
      }
    : null;
}
