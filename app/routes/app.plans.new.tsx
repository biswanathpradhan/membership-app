import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useActionData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop } from "~/services/shop.server";
import { createPlan } from "~/services/membership.server";
import { membershipPlanSchema, parseFormData } from "~/lib/validation";
import { generateSlug } from "~/lib/security";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();

  try {
    const benefitsRaw = formData.get("benefits") as string;
    const benefits = benefitsRaw
      ? benefitsRaw.split("\n").map((b) => b.trim()).filter(Boolean)
      : [];

    const data = parseFormData(membershipPlanSchema, formData);
    data.benefits = benefits;
    if (!data.slug) data.slug = generateSlug(data.name);

    await createPlan(shop.id, data, session.shop);

    if (!shop.onboardingComplete) {
      await import("~/db.server").then((db) =>
        db.default.shop.update({
          where: { id: shop.id },
          data: { onboardingComplete: true },
        }),
      );
    }

    return redirect("/app/plans");
  } catch (error) {
    if (error instanceof Error && "issues" in error) {
      return { errors: (error as { issues: Array<{ message: string }> }).issues };
    }
    return { error: error instanceof Error ? error.message : "Failed to create plan" };
  }
};

export default function NewPlan() {
  const actionData = useActionData<typeof action>();

  return (
    <s-page heading="Create Membership Plan" backAction={{ url: "/app/plans" }}>
      <form method="post">
        <s-section heading="Plan Details">
          <s-stack direction="block" gap="base">
            <s-text-field
              label="Plan Name"
              name="name"
              required
              placeholder="e.g. Gold Membership"
            />
            <s-text-area
              label="Description"
              name="description"
              placeholder="Describe what members get with this plan"
            />
            <s-text-field
              label="URL Slug"
              name="slug"
              placeholder="gold-membership"
              helpText="Used in URLs and customer tags. Auto-generated if left blank."
            />
            <s-text-field
              label="Color"
              name="color"
              value="#6366f1"
              type="color"
            />
          </s-stack>
        </s-section>

        <s-section heading="Pricing">
          <s-grid columns="3">
            <s-text-field
              label="Price"
              name="price"
              type="number"
              step="0.01"
              min="0"
              required
              placeholder="29.99"
            />
            <s-select label="Billing Interval" name="billingInterval">
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="lifetime">Lifetime</option>
            </s-select>
            <s-text-field
              label="Trial Days"
              name="trialDays"
              type="number"
              min="0"
              max="365"
              value="0"
            />
          </s-grid>
        </s-section>

        <s-section heading="Member Benefits">
          <s-grid columns="2">
            <s-text-field
              label="Discount Percentage"
              name="discountPercent"
              type="number"
              min="0"
              max="100"
              value="0"
              suffix="%"
            />
            <s-text-field
              label="Loyalty Points Multiplier"
              name="loyaltyMultiplier"
              type="number"
              min="1"
              max="10"
              step="0.1"
              value="1"
            />
          </s-grid>
          <s-stack direction="block" gap="base">
            <s-checkbox name="freeShipping" value="true" label="Free Shipping" />
            <s-checkbox name="earlyAccess" value="true" label="Early Access to Sales" />
            <s-checkbox name="exclusiveAccess" value="true" label="Exclusive Product Access" />
          </s-stack>
          <s-text-area
            label="Additional Benefits (one per line)"
            name="benefits"
            placeholder="Priority customer support&#10;Monthly newsletter&#10;Birthday gift"
          />
        </s-section>

        <s-section heading="Limits">
          <s-text-field
            label="Max Members (optional)"
            name="maxMembers"
            type="number"
            min="1"
            placeholder="Leave blank for unlimited"
          />
          <s-checkbox name="isActive" value="true" label="Plan is active" checked />
        </s-section>

        {actionData?.error && (
          <s-banner tone="critical">{actionData.error}</s-banner>
        )}

        <s-button-group>
          <s-button type="submit" variant="primary">Create Plan</s-button>
          <s-button href="/app/plans" variant="tertiary">Cancel</s-button>
        </s-button-group>
      </form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
