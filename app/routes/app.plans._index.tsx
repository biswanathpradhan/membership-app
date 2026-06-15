import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop } from "~/services/shop.server";
import { listPlans, deletePlan } from "~/services/membership.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const plans = await listPlans(shop.id);
  return { plans };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const planId = formData.get("planId") as string;
    try {
      await deletePlan(shop.id, planId, session.shop);
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Delete failed" };
    }
    return redirect("/app/plans");
  }

  if (intent === "toggle") {
    const planId = formData.get("planId") as string;
    const isActive = formData.get("isActive") === "true";
    const { updatePlan } = await import("~/services/membership.server");
    await updatePlan(shop.id, planId, { isActive: !isActive });
    return redirect("/app/plans");
  }

  return null;
};

export default function PlansIndex() {
  const { plans } = useLoaderData<typeof loader>();
  const fetcher = useFetcher();

  return (
    <s-page heading="Membership Plans" backAction={{ url: "/app" }}>
      <s-button slot="primary-action" href="/app/plans/new">
        Create Plan
      </s-button>

      {plans.length === 0 ? (
        <s-section>
          <s-empty-state heading="No membership plans yet">
            <s-paragraph>
              Create your first membership tier to start enrolling customers.
            </s-paragraph>
            <s-button href="/app/plans/new">Create Plan</s-button>
          </s-empty-state>
        </s-section>
      ) : (
        <s-section>
          <s-table>
            <s-table-header-row>
              <s-table-header>Plan</s-table-header>
              <s-table-header>Price</s-table-header>
              <s-table-header>Billing</s-table-header>
              <s-table-header>Members</s-table-header>
              <s-table-header>Benefits</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {plans.map((plan) => {
                const benefits = JSON.parse(plan.benefits || "[]") as string[];
                return (
                  <s-table-row key={plan.id}>
                    <s-table-cell>
                      <s-stack direction="inline" gap="tight">
                        <s-box
                          background={plan.color}
                          borderRadius="full"
                          minInlineSize="12px"
                          minBlockSize="12px"
                        />
                        <s-link href={`/app/plans/${plan.id}`}>{plan.name}</s-link>
                      </s-stack>
                    </s-table-cell>
                    <s-table-cell>${plan.price.toFixed(2)}</s-table-cell>
                    <s-table-cell>{plan.billingInterval}</s-table-cell>
                    <s-table-cell>{plan._count.members}</s-table-cell>
                    <s-table-cell>
                      {plan.discountPercent > 0 && `${plan.discountPercent}% off`}
                      {plan.freeShipping && " · Free shipping"}
                      {plan.exclusiveAccess && " · Exclusive"}
                      {benefits.length > 0 && ` · +${benefits.length} more`}
                    </s-table-cell>
                    <s-table-cell>
                      <s-badge tone={plan.isActive ? "success" : "warning"}>
                        {plan.isActive ? "Active" : "Inactive"}
                      </s-badge>
                    </s-table-cell>
                    <s-table-cell>
                      <s-stack direction="inline" gap="tight">
                        <s-button href={`/app/plans/${plan.id}`} variant="tertiary">
                          Edit
                        </s-button>
                        <fetcher.Form method="post">
                          <input type="hidden" name="intent" value="toggle" />
                          <input type="hidden" name="planId" value={plan.id} />
                          <input type="hidden" name="isActive" value={String(plan.isActive)} />
                          <s-button type="submit" variant="tertiary">
                            {plan.isActive ? "Deactivate" : "Activate"}
                          </s-button>
                        </fetcher.Form>
                      </s-stack>
                    </s-table-cell>
                  </s-table-row>
                );
              })}
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
