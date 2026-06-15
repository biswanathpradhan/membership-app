import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop, getDashboardStats } from "~/services/shop.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const stats = await getDashboardStats(shop.id);

  return { shop, stats };
};

export default function Dashboard() {
  const { shop, stats } = useLoaderData<typeof loader>();

  return (
    <s-page heading="MemberVault Pro">
      <s-button slot="primary-action" href="/app/plans/new">
        Create Plan
      </s-button>

      <s-section heading={`Welcome to ${shop.name || shop.shopDomain}`}>
        <s-paragraph>
          Manage memberships, loyalty rewards, and exclusive access for your store.
        </s-paragraph>
      </s-section>

      <s-section heading="Overview">
        <s-grid columns="4">
          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text tone="subdued">Total Members</s-text>
              <s-heading>{stats.totalMembers}</s-heading>
              <s-text tone="success">+{stats.newMembersLast30Days} this month</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text tone="subdued">Active Members</s-text>
              <s-heading>{stats.activeMembers}</s-heading>
              <s-text tone="subdued">{stats.churnRate}% churn rate</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text tone="subdued">Monthly Revenue</s-text>
              <s-heading>${stats.totalMrr.toFixed(2)}</s-heading>
              <s-text tone="subdued">MRR from memberships</s-text>
            </s-stack>
          </s-box>

          <s-box padding="base" borderWidth="base" borderRadius="base">
            <s-stack direction="block" gap="tight">
              <s-text tone="subdued">Active Plans</s-text>
              <s-heading>{stats.activePlans}</s-heading>
              <s-text tone="subdued">of {stats.totalPlans} total</s-text>
            </s-stack>
          </s-box>
        </s-grid>
      </s-section>

      <s-section heading="Quick Actions">
        <s-grid columns="3">
          <s-clickable href="/app/plans">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="tight">
                <s-heading>Membership Plans</s-heading>
                <s-text>Create tiers with benefits, pricing, and exclusive access.</s-text>
              </s-stack>
            </s-box>
          </s-clickable>

          <s-clickable href="/app/members">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="tight">
                <s-heading>Manage Members</s-heading>
                <s-text>View, enroll, and manage your membership base.</s-text>
              </s-stack>
            </s-box>
          </s-clickable>

          <s-clickable href="/app/loyalty">
            <s-box padding="base" borderWidth="base" borderRadius="base">
              <s-stack direction="block" gap="tight">
                <s-heading>Loyalty Program</s-heading>
                <s-text>Reward members with points, referrals, and bonuses.</s-text>
              </s-stack>
            </s-box>
          </s-clickable>
        </s-grid>
      </s-section>

      {stats.revenueByPlan.length > 0 && (
        <s-section heading="Revenue by Plan">
          <s-table>
            <s-table-header-row>
              <s-table-header>Plan</s-table-header>
              <s-table-header>Members</s-table-header>
              <s-table-header>MRR</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {stats.revenueByPlan.map((row, i) => (
                <s-table-row key={i}>
                  <s-table-cell>{row.plan?.name || "No Plan"}</s-table-cell>
                  <s-table-cell>{row.count}</s-table-cell>
                  <s-table-cell>${row.mrr.toFixed(2)}</s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {stats.recentMembers.length > 0 && (
        <s-section heading="Recent Members">
          <s-table>
            <s-table-header-row>
              <s-table-header>Name</s-table-header>
              <s-table-header>Email</s-table-header>
              <s-table-header>Plan</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Joined</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {stats.recentMembers.map((member) => (
                <s-table-row key={member.id}>
                  <s-table-cell>
                    <s-link href={`/app/members/${member.id}`}>
                      {member.firstName} {member.lastName}
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{member.email}</s-table-cell>
                  <s-table-cell>{member.plan?.name || "—"}</s-table-cell>
                  <s-table-cell>
                    <s-badge tone={member.status === "active" ? "success" : "warning"}>
                      {member.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}

      {!shop.onboardingComplete && (
        <s-section heading="Getting Started">
          <s-banner tone="info">
            <s-stack direction="block" gap="base">
              <s-text fontWeight="bold">Complete your setup in 3 steps:</s-text>
              <s-text>1. Create your first membership plan with pricing and benefits</s-text>
              <s-text>2. Configure your loyalty rewards program</s-text>
              <s-text>3. Enable the member portal on your storefront</s-text>
              <s-button href="/app/plans/new">Get Started</s-button>
            </s-stack>
          </s-banner>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
