import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop } from "~/services/shop.server";
import {
  getMember,
  updateMember,
  listPlans,
  awardLoyaltyPoints,
} from "~/services/membership.server";
import { memberUpdateSchema, parseFormData } from "~/lib/validation";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const [member, plans] = await Promise.all([
    getMember(shop.id, params.id!),
    listPlans(shop.id),
  ]);

  if (!member) throw new Response("Member not found", { status: 404 });
  return { member, plans };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "award_points") {
    const points = parseInt(formData.get("points") as string, 10);
    const description = formData.get("description") as string;
    await awardLoyaltyPoints({
      shopId: shop.id,
      memberId: params.id!,
      points,
      type: "adjustment",
      description: description || "Manual adjustment",
    });
    return redirect(`/app/members/${params.id}`);
  }

  try {
    const data = parseFormData(memberUpdateSchema, formData);
    await updateMember(shop.id, params.id!, data, session.shop);
    return redirect(`/app/members/${params.id}`);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Update failed" };
  }
};

export default function MemberDetail() {
  const { member, plans } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page
      heading={`${member.firstName || ""} ${member.lastName || ""}`.trim() || member.email}
      backAction={{ url: "/app/members" }}
    >
      <s-section heading="Member Info">
        <s-grid columns="2">
          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Email</s-text>
            <s-text>{member.email}</s-text>
          </s-stack>
          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Status</s-text>
            <s-badge tone={member.status === "active" ? "success" : "warning"}>
              {member.status}
            </s-badge>
          </s-stack>
          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Loyalty Points</s-text>
            <s-heading>{member.loyaltyPoints}</s-heading>
          </s-stack>
          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Lifetime Spend</s-text>
            <s-text>${member.lifetimeSpend.toFixed(2)}</s-text>
          </s-stack>
          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Referral Code</s-text>
            <s-text fontWeight="bold">{member.referralCode || "—"}</s-text>
          </s-stack>
          <s-stack direction="block" gap="tight">
            <s-text tone="subdued">Joined</s-text>
            <s-text>{new Date(member.joinedAt).toLocaleDateString()}</s-text>
          </s-stack>
        </s-grid>
      </s-section>

      <s-section heading="Update Member">
        <form method="post">
          <s-grid columns="2">
            <s-select label="Plan" name="planId" value={member.planId || ""}>
              <option value="">No plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </s-select>
            <s-select label="Status" name="status" value={member.status}>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
              <option value="expired">Expired</option>
            </s-select>
          </s-grid>
          <s-text-area label="Notes" name="notes" value={member.notes || ""} />
          {actionData?.error && (
            <s-banner tone="critical">{actionData.error}</s-banner>
          )}
          <s-button type="submit" variant="primary">Save Changes</s-button>
        </form>
      </s-section>

      <s-section heading="Award Loyalty Points">
        <form method="post">
          <input type="hidden" name="intent" value="award_points" />
          <s-grid columns="2">
            <s-text-field label="Points" name="points" type="number" required />
            <s-text-field label="Description" name="description" placeholder="Reason for award" />
          </s-grid>
          <s-button type="submit" variant="secondary">Award Points</s-button>
        </form>
      </s-section>

      {member.loyaltyTransactions.length > 0 && (
        <s-section heading="Loyalty History">
          <s-table>
            <s-table-header-row>
              <s-table-header>Date</s-table-header>
              <s-table-header>Type</s-table-header>
              <s-table-header>Points</s-table-header>
              <s-table-header>Balance</s-table-header>
              <s-table-header>Description</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {member.loyaltyTransactions.map((tx) => (
                <s-table-row key={tx.id}>
                  <s-table-cell>
                    {new Date(tx.createdAt).toLocaleDateString()}
                  </s-table-cell>
                  <s-table-cell>{tx.type}</s-table-cell>
                  <s-table-cell>
                    {tx.points > 0 ? `+${tx.points}` : tx.points}
                  </s-table-cell>
                  <s-table-cell>{tx.balance}</s-table-cell>
                  <s-table-cell>{tx.description || "—"}</s-table-cell>
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
