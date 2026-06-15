import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData, useSearchParams, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop } from "~/services/shop.server";
import { listMembers, listPlans } from "~/services/membership.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || undefined;
  const planId = url.searchParams.get("planId") || undefined;
  const search = url.searchParams.get("search") || undefined;
  const page = parseInt(url.searchParams.get("page") || "1", 10);

  const [result, plans] = await Promise.all([
    listMembers(shop.id, { status, planId, search, page }),
    listPlans(shop.id),
  ]);

  return { ...result, plans, filters: { status, planId, search } };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "enroll") {
    const email = formData.get("email") as string;
    const planId = formData.get("planId") as string;

    const customerResponse = await admin.graphql(
      `#graphql
      query findCustomer($query: String!) {
        customers(first: 1, query: $query) {
          edges { node { id email firstName lastName } }
        }
      }`,
      { variables: { query: `email:${email}` } },
    );
    const customerJson = await customerResponse.json();
    const customer = customerJson.data?.customers?.edges?.[0]?.node;

    if (!customer) {
      return { error: "Customer not found in Shopify. They must have an account first." };
    }

    const { enrollMember, getMemberShopifyTags } = await import("~/services/membership.server");
    const { syncMemberTags } = await import("~/services/shopify-sync.server");

    const member = await enrollMember({
      shopId: shop.id,
      shopifyCustomerId: customer.id.replace("gid://shopify/Customer/", ""),
      email: customer.email,
      firstName: customer.firstName,
      lastName: customer.lastName,
      planId: planId || undefined,
      actor: session.shop,
    });

    const plan = planId
      ? await import("~/db.server").then((db) =>
          db.default.membershipPlan.findUnique({ where: { id: planId } }),
        )
      : null;

    await syncMemberTags(
      admin,
      customer.id,
      getMemberShopifyTags(plan?.slug),
    );

    return { success: true, memberId: member.id };
  }

  return null;
};

export default function MembersIndex() {
  const { members, total, page, totalPages, plans, filters } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();

  return (
    <s-page heading="Members" backAction={{ url: "/app" }}>
      <s-section heading="Enroll Member">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="enroll" />
          <s-grid columns="3">
            <s-text-field
              label="Customer Email"
              name="email"
              type="email"
              required
              placeholder="customer@example.com"
            />
            <s-select label="Plan" name="planId">
              <option value="">No plan</option>
              {plans
                .filter((p) => p.isActive)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </s-select>
            <s-button type="submit" variant="primary">
              Enroll Member
            </s-button>
          </s-grid>
        </fetcher.Form>
        {fetcher.data?.error && (
          <s-banner tone="critical">{fetcher.data.error}</s-banner>
        )}
        {fetcher.data?.success && (
          <s-banner tone="success">Member enrolled successfully!</s-banner>
        )}
      </s-section>

      <s-section heading={`All Members (${total})`}>
        <s-grid columns="3">
          <s-text-field
            label="Search"
            value={filters.search || ""}
            placeholder="Name or email..."
            onChange={(e: Event) => {
              const target = e.target as HTMLInputElement;
              const params = new URLSearchParams(searchParams);
              if (target.value) params.set("search", target.value);
              else params.delete("search");
              setSearchParams(params);
            }}
          />
          <s-select
            label="Status"
            value={filters.status || ""}
            onChange={(e: Event) => {
              const target = e.target as HTMLSelectElement;
              const params = new URLSearchParams(searchParams);
              if (target.value) params.set("status", target.value);
              else params.delete("status");
              setSearchParams(params);
            }}
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </s-select>
          <s-select
            label="Plan"
            value={filters.planId || ""}
            onChange={(e: Event) => {
              const target = e.target as HTMLSelectElement;
              const params = new URLSearchParams(searchParams);
              if (target.value) params.set("planId", target.value);
              else params.delete("planId");
              setSearchParams(params);
            }}
          >
            <option value="">All plans</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </s-select>
        </s-grid>

        {members.length === 0 ? (
          <s-empty-state heading="No members found">
            <s-paragraph>Enroll your first member or adjust your filters.</s-paragraph>
          </s-empty-state>
        ) : (
          <s-table>
            <s-table-header-row>
              <s-table-header>Member</s-table-header>
              <s-table-header>Plan</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Points</s-table-header>
              <s-table-header>Lifetime Spend</s-table-header>
              <s-table-header>Joined</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {members.map((member) => (
                <s-table-row key={member.id}>
                  <s-table-cell>
                    <s-link href={`/app/members/${member.id}`}>
                      <s-stack direction="block" gap="extraTight">
                        <s-text fontWeight="bold">
                          {member.firstName} {member.lastName}
                        </s-text>
                        <s-text tone="subdued">{member.email}</s-text>
                      </s-stack>
                    </s-link>
                  </s-table-cell>
                  <s-table-cell>{member.plan?.name || "—"}</s-table-cell>
                  <s-table-cell>
                    <s-badge
                      tone={
                        member.status === "active"
                          ? "success"
                          : member.status === "cancelled"
                            ? "critical"
                            : "warning"
                      }
                    >
                      {member.status}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>{member.loyaltyPoints}</s-table-cell>
                  <s-table-cell>${member.lifetimeSpend.toFixed(2)}</s-table-cell>
                  <s-table-cell>
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}

        {totalPages > 1 && (
          <s-button-group>
            {page > 1 && (
              <s-button
                href={`?page=${page - 1}${filters.status ? `&status=${filters.status}` : ""}`}
                variant="tertiary"
              >
                Previous
              </s-button>
            )}
            <s-text>
              Page {page} of {totalPages}
            </s-text>
            {page < totalPages && (
              <s-button
                href={`?page=${page + 1}${filters.status ? `&status=${filters.status}` : ""}`}
                variant="tertiary"
              >
                Next
              </s-button>
            )}
          </s-button-group>
        )}
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
