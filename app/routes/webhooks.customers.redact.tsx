import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "~/services/shop.server";
import { redactCustomerData } from "~/services/shopify-sync.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} GDPR webhook for ${shop}`);

  const shopRecord = await getOrCreateShop(shop);
  const customer = payload as { customer?: { id: string } };
  const customerId = customer.customer?.id;

  if (customerId) {
    await redactCustomerData(shopRecord.id, String(customerId));
  }

  return new Response();
};
