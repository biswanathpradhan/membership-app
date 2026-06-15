import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  if (url.searchParams.get("shop")) {
    throw new Response(null, {
      status: 302,
      headers: { Location: `/app?${url.searchParams.toString()}` },
    });
  }

  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>MemberVault Pro - Privacy Policy</title>
  <style>
    body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #333; }
    h1 { color: #6366f1; } h2 { margin-top: 2em; }
  </style>
</head>
<body>
  <h1>Privacy Policy</h1>
  <p><em>Last updated: June 2026</em></p>

  <h2>1. Information We Collect</h2>
  <p>MemberVault Pro collects customer email addresses, names, order history, and membership status to provide membership management services to Shopify merchants.</p>

  <h2>2. How We Use Information</h2>
  <p>We use collected data solely to:</p>
  <ul>
    <li>Manage membership tiers and benefits</li>
    <li>Track loyalty points and rewards</li>
    <li>Process referral programs</li>
    <li>Provide analytics to merchants</li>
  </ul>

  <h2>3. Data Storage & Security</h2>
  <p>All data is encrypted in transit (TLS) and at rest. We use industry-standard security practices including HMAC webhook verification, session token authentication, and rate limiting.</p>

  <h2>4. Data Retention</h2>
  <p>Customer data is retained while the merchant uses our app. Upon app uninstallation or GDPR redaction requests, all associated customer data is permanently deleted within 30 days.</p>

  <h2>5. GDPR Compliance</h2>
  <p>We fully comply with GDPR requirements. Merchants and customers can request data export or deletion through Shopify's mandatory compliance webhooks.</p>

  <h2>6. Third-Party Sharing</h2>
  <p>We do not sell or share customer data with third parties. Data is only processed within the Shopify ecosystem as required for app functionality.</p>

  <h2>7. Contact</h2>
  <p>For privacy inquiries, contact the app developer through the Shopify App Store listing.</p>
</body>
</html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
};
