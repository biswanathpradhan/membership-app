import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop } from "~/services/shop.server";
import { getPlan, updatePlan, deletePlan } from "~/services/membership.server";
import { membershipPlanSchema, parseFormData } from "~/lib/validation";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const plan = await getPlan(shop.id, params.id!);

  if (!plan) throw new Response("Plan not found", { status: 404 });

  const benefits = JSON.parse(plan.benefits || "[]") as string[];
  return { plan: { ...plan, benefitsList: benefits } };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    try {
      await deletePlan(shop.id, params.id!, session.shop);
      return redirect("/app/plans");
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Delete failed" };
    }
  }

  try {
    const benefitsRaw = formData.get("benefits") as string;
    const benefits = benefitsRaw
      ? benefitsRaw.split("\n").map((b) => b.trim()).filter(Boolean)
      : [];

    const data = parseFormData(membershipPlanSchema, formData);
    data.benefits = benefits;

    await updatePlan(shop.id, params.id!, data, session.shop);
    return redirect("/app/plans");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Update failed" };
  }
};

export default function EditPlan() {
  const { plan } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading={`Edit: ${plan.name}`} backAction={{ url: "/app/plans" }}>
      <form method="post">
        <s-section heading="Plan Details">
          <s-stack direction="block" gap="base">
            <s-text-field label="Plan Name" name="name" value={plan.name} required />
            <s-text-area
              label="Description"
              name="description"
              value={plan.description || ""}
            />
            <s-text-field label="URL Slug" name="slug" value={plan.slug} />
            <s-text-field label="Color" name="color" value={plan.color} type="color" />
          </s-stack>
        </s-section>

        <s-section heading="Pricing">
          <s-grid columns="3">
            <s-text-field
              label="Price"
              name="price"
              type="number"
              step="0.01"
              value={String(plan.price)}
              required
            />
            <s-select label="Billing Interval" name="billingInterval" value={plan.billingInterval}>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="lifetime">Lifetime</option>
            </s-select>
            <s-text-field
              label="Trial Days"
              name="trialDays"
              type="number"
              value={String(plan.trialDays)}
            />
          </s-grid>
        </s-section>

        <s-section heading="Member Benefits">
          <s-grid columns="2">
            <s-text-field
              label="Discount %"
              name="discountPercent"
              type="number"
              value={String(plan.discountPercent)}
            />
            <s-text-field
              label="Loyalty Multiplier"
              name="loyaltyMultiplier"
              type="number"
              step="0.1"
              value={String(plan.loyaltyMultiplier)}
            />
          </s-grid>
          <s-stack direction="block" gap="base">
            <s-checkbox
              name="freeShipping"
              value="true"
              label="Free Shipping"
              checked={plan.freeShipping}
            />
            <s-checkbox
              name="earlyAccess"
              value="true"
              label="Early Access"
              checked={plan.earlyAccess}
            />
            <s-checkbox
              name="exclusiveAccess"
              value="true"
              label="Exclusive Access"
              checked={plan.exclusiveAccess}
            />
          </s-stack>
          <s-text-area
            label="Additional Benefits"
            name="benefits"
            value={plan.benefitsList.join("\n")}
          />
        </s-section>

        <s-section heading="Stats">
          <s-text>{plan._count.members} active members on this plan</s-text>
        </s-section>

        {actionData?.error && (
          <s-banner tone="critical">{actionData.error}</s-banner>
        )}

        <s-button-group>
          <s-button type="submit" variant="primary">Save Changes</s-button>
          <s-button href="/app/plans" variant="tertiary">Cancel</s-button>
        </s-button-group>
      </form>

      <s-section heading="Danger Zone">
        <form method="post">
          <input type="hidden" name="intent" value="delete" />
          <s-button type="submit" variant="primary" tone="critical">
            Delete Plan
          </s-button>
        </form>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
