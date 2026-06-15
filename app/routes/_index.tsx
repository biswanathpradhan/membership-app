import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { login } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function AppIndex() {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 600, margin: "80px auto", padding: 20, textAlign: "center" }}>
      <h1 style={{ color: "#6366f1" }}>MemberVault Pro</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Advanced E-Commerce & Membership Management for Shopify
      </p>
      <p>Install this app from your Shopify admin or Partners dashboard.</p>
      <p style={{ marginTop: 24 }}>
        <a href="/privacy" style={{ color: "#6366f1" }}>Privacy Policy</a>
      </p>
    </div>
  );
}
