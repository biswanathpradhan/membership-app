import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

const BILLING_PLAN_NAME = process.env.BILLING_PLAN_NAME || "MemberVault Pro";
const BILLING_AMOUNT = parseFloat(process.env.BILLING_AMOUNT || "29.99");
const BILLING_CURRENCY = process.env.BILLING_CURRENCY || "USD";
const BILLING_INTERVAL = process.env.BILLING_INTERVAL || "EVERY_30_DAYS";
const BILLING_TRIAL_DAYS = parseInt(process.env.BILLING_TRIAL_DAYS || "14", 10);

export async function ensureBilling(
  admin: AdminApiContext,
  shopDomain: string,
  isTest = process.env.NODE_ENV !== "production",
): Promise<{ hasActivePayment: boolean; confirmationUrl?: string }> {
  const response = await admin.graphql(
    `#graphql
    query {
      currentAppInstallation {
        activeSubscriptions {
          id
          name
          status
          test
        }
      }
    }`,
  );

  const json = await response.json();
  const subscriptions =
    json.data?.currentAppInstallation?.activeSubscriptions ?? [];

  const activeSubscription = subscriptions.find(
    (sub: { status: string }) => sub.status === "ACTIVE",
  );

  if (activeSubscription) {
    return { hasActivePayment: true };
  }

  const returnUrl = `${process.env.SHOPIFY_APP_URL}/app/billing/callback?shop=${shopDomain}`;

  const createResponse = await admin.graphql(
    `#graphql
    mutation appSubscriptionCreate($name: String!, $returnUrl: URL!, $test: Boolean, $trialDays: Int, $lineItems: [AppSubscriptionLineItemInput!]!) {
      appSubscriptionCreate(
        name: $name
        returnUrl: $returnUrl
        test: $test
        trialDays: $trialDays
        lineItems: $lineItems
      ) {
        appSubscription { id status }
        confirmationUrl
        userErrors { field message }
      }
    }`,
    {
      variables: {
        name: BILLING_PLAN_NAME,
        returnUrl,
        test: isTest,
        trialDays: BILLING_TRIAL_DAYS,
        lineItems: [
          {
            plan: {
              appRecurringPricingDetails: {
                price: { amount: BILLING_AMOUNT, currencyCode: BILLING_CURRENCY },
                interval: BILLING_INTERVAL,
              },
            },
          },
        ],
      },
    },
  );

  const createJson = await createResponse.json();
  const confirmationUrl =
    createJson.data?.appSubscriptionCreate?.confirmationUrl;

  return {
    hasActivePayment: false,
    confirmationUrl,
  };
}

export async function checkBillingStatus(
  admin: AdminApiContext,
): Promise<boolean> {
  const response = await admin.graphql(
    `#graphql
    query {
      currentAppInstallation {
        activeSubscriptions {
          status
        }
      }
    }`,
  );

  const json = await response.json();
  const subscriptions =
    json.data?.currentAppInstallation?.activeSubscriptions ?? [];

  return subscriptions.some((sub: { status: string }) => sub.status === "ACTIVE");
}
