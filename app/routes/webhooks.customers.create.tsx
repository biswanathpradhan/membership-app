import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "~/services/shop.server";
import { handleCustomerCreated } from "~/services/shopify-sync.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const shopRecord = await getOrCreateShop(shop);
  await handleCustomerCreated(
    shopRecord.id,
    payload as { id: string; email: string; first_name?: string; last_name?: string },
  );

  return new Response();
};
