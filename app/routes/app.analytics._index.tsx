import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop, getDashboardStats } from "~/services/shop.server";
import prisma from "~/db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const stats = await getDashboardStats(shop.id);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const memberGrowth = await prisma.member.groupBy({
    by: ["joinedAt"],
    where: { shopId: shop.id, joinedAt: { gte: thirtyDaysAgo } },
    _count: true,
  });

  const loyaltyStats = await prisma.loyaltyTransaction.groupBy({
    by: ["type"],
    where: { program: { shopId: shop.id } },
    _sum: { points: true },
    _count: true,
  });

  const referralStats = await prisma.referral.groupBy({
    by: ["status"],
    where: { shopId: shop.id },
    _count: true,
  });

  return { stats, memberGrowth, loyaltyStats, referralStats };
};

export default function AnalyticsPage() {
  const { stats, loyaltyStats, referralStats } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Analytics" backAction={{ url: "/app" }}>
      <s-section heading="Key Metrics">
        <s-grid columns="4">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="subdued">Monthly Recurring Revenue</s-text>
            <s-heading>${stats.totalMrr.toFixed(2)}</s-heading>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="subdued">Lifetime Revenue</s-text>
            <s-heading>${stats.lifetimeRevenue.toFixed(2)}</s-heading>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="subdued">Churn Rate (30d)</s-text>
            <s-heading>{stats.churnRate}%</s-heading>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="subdued">Completed Referrals</s-text>
            <s-heading>{stats.completedReferrals}</s-heading>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Membership Growth">
        <s-grid columns="3">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="subdued">Total Members</s-text>
            <s-heading>{stats.totalMembers}</s-heading>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="subdued">Active Members</s-text>
            <s-heading>{stats.activeMembers}</s-heading>
          </s-box>
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-text tone="subdued">New (30 days)</s-text>
            <s-heading>{stats.newMembersLast30Days}</s-heading>
          </s-box>
        </s-grid>
      </s-section>

      {stats.revenueByPlan.length > 0 && (
        <s-section heading="Revenue Breakdown by Plan">
          <s-table>
            <s-table-header-row>
              <s-table-header>Plan</s-table-header>
              <s-table-header>Active Members</s-table-header>
              <s-table-header>Monthly Revenue</s-table-header>
              <s-table-header>% of Total</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {stats.revenueByPlan.map((row, i) => (
                <s-table-row key={i}>
                  <s-table-cell>{row.plan?.name || "Unassigned"}</s-table-cell>
                  <s-table-cell>{row.count}</s-table-cell>
                  <s-table-cell>${row.mrr.toFixed(2)}</s-table-cell>
                  <s-table-cell>
                    {stats.totalMrr > 0
                      ? ((row.mrr / stats.totalMrr) * 100).toFixed(1)
                      : 0}
                    %
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {loyaltyStats.length > 0 && (
        <s-section heading="Loyalty Activity">
          <s-table>
            <s-table-header-row>
              <s-table-header>Transaction Type</s-table-header>
              <s-table-header>Count</s-table-header>
              <s-table-header>Total Points</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {loyaltyStats.map((stat) => (
                <s-table-row key={stat.type}>
                  <s-table-cell>{stat.type}</s-table-cell>
                  <s-table-cell>{stat._count}</s-table-cell>
                  <s-table-cell>{stat._sum.points?.toLocaleString() ?? 0}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {referralStats.length > 0 && (
        <s-section heading="Referral Program">
          <s-table>
            <s-table-header-row>
              <s-table-header>Status</s-table-header>
              <s-table-header>Count</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {referralStats.map((stat) => (
                <s-table-row key={stat.status}>
                  <s-table-cell>{stat.status}</s-table-cell>
                  <s-table-cell>{stat._count}</s-table-cell>
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
