import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} GDPR shop redact for ${shop}`);

  const shopRecord = await prisma.shop.findUnique({ where: { shopDomain: shop } });
  if (shopRecord) {
    await prisma.shop.delete({ where: { id: shopRecord.id } });
  }

  return new Response();
};
