import type { LoaderFunctionArgs } from "react-router";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await login(request);
  return null;
};
