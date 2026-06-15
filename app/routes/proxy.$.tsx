import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import prisma from "~/db.server";
import { getOrCreateShop } from "~/services/shop.server";
import { checkRateLimit, getClientIp } from "~/lib/security";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);

  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rateLimit = await checkRateLimit(`proxy:${session.shop}:${getClientIp(request)}`, 30);
  if (!rateLimit.allowed) {
    return new Response("Too many requests", { status: 429 });
  }

  const shop = await getOrCreateShop(session.shop);
  const url = new URL(request.url);
  const customerId = url.searchParams.get("logged_in_customer_id");

  if (!customerId) {
    return renderPortal({
      title: "Member Portal",
      content: `
        <div class="mv-portal">
          <h1>Member Portal</h1>
          <p>Please <a href="/account/login">log in</a> to view your membership.</p>
        </div>
      `,
    });
  }

  const member = await prisma.member.findUnique({
    where: {
      shopId_shopifyCustomerId: {
        shopId: shop.id,
        shopifyCustomerId: customerId,
      },
    },
    include: { plan: true },
  });

  if (!member) {
    return renderPortal({
      title: "Member Portal",
      content: `
        <div class="mv-portal">
          <h1>Welcome!</h1>
          <p>You're not a member yet. Shop our membership plans to get started.</p>
        </div>
      `,
    });
  }

  const recentTransactions = await prisma.loyaltyTransaction.findMany({
    where: { memberId: member.id },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const benefits = member.plan
    ? (JSON.parse(member.plan.benefits || "[]") as string[])
    : [];

  return renderPortal({
    title: "My Membership",
    content: `
      <div class="mv-portal">
        <div class="mv-header">
          <h1>My Membership</h1>
          <span class="mv-badge mv-badge--${member.status}">${member.status}</span>
        </div>

        <div class="mv-card">
          <h2>${member.plan?.name || "Member"}</h2>
          ${member.plan?.description ? `<p>${member.plan.description}</p>` : ""}
          <div class="mv-stats">
            <div class="mv-stat">
              <span class="mv-stat__value">${member.loyaltyPoints}</span>
              <span class="mv-stat__label">Loyalty Points</span>
            </div>
            <div class="mv-stat">
              <span class="mv-stat__value">$${member.lifetimeSpend.toFixed(2)}</span>
              <span class="mv-stat__label">Lifetime Spend</span>
            </div>
            <div class="mv-stat">
              <span class="mv-stat__value">${new Date(member.joinedAt).toLocaleDateString()}</span>
              <span class="mv-stat__label">Member Since</span>
            </div>
          </div>
        </div>

        ${benefits.length > 0 ? `
          <div class="mv-card">
            <h3>Your Benefits</h3>
            <ul class="mv-benefits">
              ${member.plan?.discountPercent ? `<li>${member.plan.discountPercent}% discount on all orders</li>` : ""}
              ${member.plan?.freeShipping ? `<li>Free shipping on all orders</li>` : ""}
              ${member.plan?.earlyAccess ? `<li>Early access to sales</li>` : ""}
              ${benefits.map((b) => `<li>${b}</li>`).join("")}
            </ul>
          </div>
        ` : ""}

        ${member.referralCode ? `
          <div class="mv-card">
            <h3>Refer a Friend</h3>
            <p>Share your code: <strong>${member.referralCode}</strong></p>
          </div>
        ` : ""}

        ${recentTransactions.length > 0 ? `
          <div class="mv-card">
            <h3>Recent Points Activity</h3>
            <table class="mv-table">
              <thead><tr><th>Date</th><th>Points</th><th>Description</th></tr></thead>
              <tbody>
                ${recentTransactions.map((tx) => `
                  <tr>
                    <td>${new Date(tx.createdAt).toLocaleDateString()}</td>
                    <td>${tx.points > 0 ? "+" : ""}${tx.points}</td>
                    <td>${tx.description || tx.type}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : ""}
      </div>
    `,
  });
};

function renderPortal({ title, content }: { title: string; content: string }) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f6f6f7; color: #1a1a1a; line-height: 1.5; }
    .mv-portal { max-width: 720px; margin: 0 auto; padding: 24px 16px; }
    .mv-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .mv-header h1 { font-size: 28px; font-weight: 600; }
    .mv-badge { padding: 4px 12px; border-radius: 20px; font-size: 13px; font-weight: 500; text-transform: capitalize; }
    .mv-badge--active { background: #d1fae5; color: #065f46; }
    .mv-badge--paused { background: #fef3c7; color: #92400e; }
    .mv-badge--cancelled { background: #fee2e2; color: #991b1b; }
    .mv-card { background: #fff; border-radius: 12px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .mv-card h2 { font-size: 22px; margin-bottom: 8px; }
    .mv-card h3 { font-size: 18px; margin-bottom: 12px; }
    .mv-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 20px; }
    .mv-stat { text-align: center; }
    .mv-stat__value { display: block; font-size: 24px; font-weight: 700; color: #6366f1; }
    .mv-stat__label { font-size: 13px; color: #6b7280; }
    .mv-benefits { list-style: none; padding: 0; }
    .mv-benefits li { padding: 8px 0; border-bottom: 1px solid #f3f4f6; }
    .mv-benefits li:before { content: "✓ "; color: #10b981; font-weight: bold; }
    .mv-table { width: 100%; border-collapse: collapse; }
    .mv-table th, .mv-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #f3f4f6; }
    .mv-table th { font-size: 13px; color: #6b7280; font-weight: 500; }
    a { color: #6366f1; }
    @media (max-width: 600px) { .mv-stats { grid-template-columns: 1fr; } }
  </style>
</head>
<body>${content}</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
