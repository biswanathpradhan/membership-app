import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop } from "~/services/shop.server";
import prisma from "~/db.server";
import { loyaltySettingsSchema, parseFormData } from "~/lib/validation";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const program = await prisma.loyaltyProgram.findUnique({
    where: { shopId: shop.id },
    include: { _count: { select: { transactions: true } } },
  });

  const topMembers = await prisma.member.findMany({
    where: { shopId: shop.id },
    orderBy: { loyaltyPoints: "desc" },
    take: 10,
    select: { id: true, firstName: true, lastName: true, email: true, loyaltyPoints: true },
  });

  const totalPointsAwarded = await prisma.loyaltyTransaction.aggregate({
    where: { program: { shopId: shop.id }, points: { gt: 0 } },
    _sum: { points: true },
  });

  return { program, topMembers, totalPointsAwarded: totalPointsAwarded._sum.points || 0 };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const data = parseFormData(loyaltySettingsSchema, formData);

  await prisma.loyaltyProgram.upsert({
    where: { shopId: shop.id },
    create: { shopId: shop.id, ...data },
    update: data,
  });

  return redirect("/app/loyalty");
};

export default function LoyaltyPage() {
  const { program, topMembers, totalPointsAwarded } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Loyalty & Rewards" backAction={{ url: "/app" }}>
      <s-section heading="Program Settings">
        <form method="post">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Program Name"
              name="name"
              value={program?.name || "Rewards Program"}
              required
            />
            <s-grid columns="2">
              <s-text-field
                label="Points per Dollar Spent"
                name="pointsPerDollar"
                type="number"
                step="0.1"
                value={String(program?.pointsPerDollar ?? 1)}
                required
              />
              <s-checkbox
                name="isActive"
                value="true"
                label="Program Active"
                checked={program?.isActive ?? true}
              />
            </s-grid>
          </s-stack>

          <s-section heading="Bonus Points">
            <s-grid columns="2">
              <s-text-field
                label="Signup Bonus"
                name="signupBonus"
                type="number"
                value={String(program?.signupBonus ?? 100)}
              />
              <s-text-field
                label="Referral Bonus"
                name="referralBonus"
                type="number"
                value={String(program?.referralBonus ?? 250)}
              />
              <s-text-field
                label="Review Bonus"
                name="reviewBonus"
                type="number"
                value={String(program?.reviewBonus ?? 50)}
              />
              <s-text-field
                label="Birthday Bonus"
                name="birthdayBonus"
                type="number"
                value={String(program?.birthdayBonus ?? 100)}
              />
            </s-grid>
          </s-section>

          <s-button type="submit" variant="primary">Save Settings</s-button>
        </form>
      </s-section>

      <s-section heading="Program Stats">
        <s-grid columns="2">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="subdued">Total Points Awarded</s-text>
            <s-heading>{totalPointsAwarded.toLocaleString()}</s-heading>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="subdued">Total Transactions</s-text>
            <s-heading>{program?._count.transactions ?? 0}</s-heading>
          </s-box>
        </s-grid>
      </s-section>

      {topMembers.length > 0 && (
        <s-section heading="Top Members by Points">
          <s-table>
            <s-table-header-row>
              <s-table-header>Member</s-table-header>
              <s-table-header>Points</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {topMembers.map((member, i) => (
                <s-table-row key={member.id}>
                  <s-table-cell>
                    <s-link href={`/app/members/${member.id}`}>
                      {member.firstName} {member.lastName} ({member.email})
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{member.loyaltyPoints.toLocaleString()}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
