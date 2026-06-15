import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "~/services/shop.server";
import { handleOrderCreated } from "~/services/shopify-sync.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const shopRecord = await getOrCreateShop(shop);
  await handleOrderCreated(shopRecord.id, payload as Parameters<typeof handleOrderCreated>[1]);

  return new Response();
};
