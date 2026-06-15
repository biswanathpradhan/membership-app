import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { Form, useActionData, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import { loginErrorMessage } from "~/lib/auth";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));
  return { errors };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const errors = loginErrorMessage(await login(request));
  return { errors };
};

export default function Auth() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [shop, setShop] = useState("");
  const errors = actionData?.errors || loaderData?.errors;

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 400, margin: "80px auto", padding: 20 }}>
      <h1 style={{ color: "#6366f1", marginBottom: 8 }}>MemberVault Pro</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Log in to your Shopify store</p>
      <Form method="post">
        <label style={{ display: "block", marginBottom: 8, fontWeight: 500 }}>
          Shop domain
        </label>
        <input
          type="text"
          name="shop"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="my-store.myshopify.com"
          style={{ width: "100%", padding: "10px 12px", border: "1px solid #ccc", borderRadius: 6, marginBottom: 16 }}
          autoComplete="on"
        />
        {errors?.shop && (
          <p style={{ color: "#dc2626", marginBottom: 12 }}>{errors.shop}</p>
        )}
        <button
          type="submit"
          style={{ width: "100%", padding: "12px", background: "#6366f1", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer" }}
        >
          Log in
        </button>
      </Form>
    </div>
  );
}
