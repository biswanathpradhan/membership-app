import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "~/services/shop.server";
import { exportCustomerData } from "~/services/shopify-sync.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} GDPR data request for ${shop}`);

  const shopRecord = await getOrCreateShop(shop);
  const data = payload as { customer?: { id: string; email: string } };
  const customerId = data.customer?.id;

  if (customerId) {
    const customerData = await exportCustomerData(shopRecord.id, String(customerId));
    console.log("Customer data export:", JSON.stringify(customerData));
  }

  return new Response();
};
