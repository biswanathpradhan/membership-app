import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { redirect, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getOrCreateShop, getShopSettings, updateShopSettings } from "~/services/shop.server";
import { shopSettingsSchema, parseFormData } from "~/lib/validation";
import { checkBillingStatus } from "~/services/billing.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const settings = await getShopSettings(shop.id);
  const hasBilling = await checkBillingStatus(admin);

  return { shop, settings, hasBilling };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getOrCreateShop(session.shop);
  const formData = await request.formData();
  const data = parseFormData(shopSettingsSchema, formData);
  await updateShopSettings(shop.id, data);
  return redirect("/app/settings");
};

export default function SettingsPage() {
  const { shop, settings, hasBilling } = useLoaderData<typeof loader>();

  return (
    <s-page heading="Settings" backAction={{ url: "/app" }}>
      <s-section heading="General Settings">
        <form method="post">
          <s-stack direction="block" gap="base">
            <s-checkbox
              name="autoEnrollOnPurchase"
              value="true"
              label="Auto-enroll customers on first purchase"
              checked={settings.autoEnrollOnPurchase !== false}
            />
            <s-checkbox
              name="welcomeEmail"
              value="true"
              label="Send welcome email to new members"
              checked={settings.welcomeEmail !== false}
            />
            <s-checkbox
              name="showMemberBadge"
              value="true"
              label="Show member badge on storefront"
              checked={settings.showMemberBadge !== false}
            />
            <s-checkbox
              name="portalEnabled"
              value="true"
              label="Enable customer member portal"
              checked={settings.portalEnabled !== false}
            />
            <s-checkbox
              name="referralEnabled"
              value="true"
              label="Enable referral program"
              checked={settings.referralEnabled !== false}
            />
            <s-checkbox
              name="loyaltyEnabled"
              value="true"
              label="Enable loyalty points program"
              checked={settings.loyaltyEnabled !== false}
            />
          </s-stack>
          <s-button type="submit" variant="primary">Save Settings</s-button>
        </form>
      </s-section>

      <s-section heading="Storefront Portal">
        <s-paragraph>
          Your customers can access their membership portal at:
        </s-paragraph>
        <s-text fontWeight="bold">
          https://{shop.shopDomain}/apps/members
        </s-text>
        <s-paragraph>
          Enable the Member Portal theme extension in your theme editor to add
          membership widgets to your storefront.
        </s-paragraph>
      </s-section>

      <s-section heading="Billing">
        <s-stack direction="block" gap="tight">
          <s-text>
            Plan: <strong>{shop.billingPlan}</strong>
          </s-text>
          <s-text>
            Status:{" "}
            <s-badge tone={hasBilling ? "success" : "warning"}>
              {hasBilling ? "Active" : "Trial / Pending"}
            </s-badge>
          </s-text>
          {shop.trialEndsAt && (
            <s-text>
              Trial ends: {new Date(shop.trialEndsAt).toLocaleDateString()}
            </s-text>
          )}
        </s-stack>
      </s-section>

      <s-section heading="Security & Compliance">
        <s-stack direction="block" gap="tight">
          <s-text>✓ GDPR webhook handlers enabled</s-text>
          <s-text>✓ HMAC webhook verification active</s-text>
          <s-text>✓ Session token authentication</s-text>
          <s-text>✓ Rate limiting enabled</s-text>
          <s-text>✓ Audit logging active</s-text>
        </s-stack>
      </s-section>

      <s-section heading="App Information">
        <s-text>MemberVault Pro v1.0.0</s-text>
        <s-link href="/privacy" target="_blank">
          Privacy Policy
        </s-link>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
