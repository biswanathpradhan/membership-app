import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getOrCreateShop } from "~/services/shop.server";
import prisma from "~/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const shopRecord = await getOrCreateShop(shop);
  const customer = payload as {
    id: string;
    email: string;
    first_name?: string;
    last_name?: string;
  };

  await prisma.member.updateMany({
    where: {
      shopId: shopRecord.id,
      shopifyCustomerId: String(customer.id),
    },
    data: {
      email: customer.email,
      firstName: customer.first_name,
      lastName: customer.last_name,
    },
  });

  return new Response();
};
