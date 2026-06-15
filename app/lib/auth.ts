import type { LoginError, LoginErrorType } from "@shopify/shopify-app-react-router/server";

export function loginErrorMessage(loginErrors: LoginError | undefined): {
  shop?: string;
} {
  if (!loginErrors?.shop) return {};
  if (loginErrors.shop === ("MISSING_SHOP" as LoginErrorType)) {
    return { shop: "Please enter your shop domain" };
  }
  if (loginErrors.shop === ("INVALID_SHOP" as LoginErrorType)) {
    return { shop: "Please enter a valid shop domain" };
  }
  return {};
}
