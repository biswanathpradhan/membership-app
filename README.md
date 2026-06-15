# MemberVault Pro

**Advanced E-Commerce & Membership Management for Shopify**

MemberVault Pro is a production-ready Shopify app that helps merchants create membership tiers, manage loyal customers, run loyalty programs, and grow recurring revenue — all from one embedded admin dashboard.

---

## Features

### Membership Management
- Create unlimited membership plans (Bronze, Silver, Gold, etc.)
- Flexible billing: monthly, quarterly, yearly, or lifetime
- Per-plan benefits: discounts, free shipping, early access, exclusive products
- Trial periods and member limits
- Auto-enroll customers on purchase

### Member Dashboard
- Search, filter, and paginate members
- Manual enrollment by email
- Status management (active, paused, cancelled, expired)
- Member notes and loyalty point adjustments
- Shopify customer tag sync

### Loyalty & Rewards
- Points per dollar spent
- Signup, referral, review, and birthday bonuses
- Loyalty multiplier per membership tier
- Full transaction history

### Referral Program
- Unique referral codes per member
- Automatic reward tracking
- Referral analytics

### Analytics
- MRR and lifetime revenue tracking
- Churn rate monitoring
- Revenue breakdown by plan
- Loyalty and referral stats

### Storefront
- Customer member portal at `/apps/members`
- Theme app extension widget
- Member badge support

### Security (App Store Ready)
- HMAC webhook verification
- Session token authentication
- GDPR compliance webhooks (data request, customer redact, shop redact)
- Rate limiting on public endpoints
- Audit logging for all admin actions
- Input validation with Zod
- Privacy policy page

### Billing
- Shopify Billing API integration
- 14-day free trial (configurable)
- Recurring app charges for merchants

---

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) 20.19+ or 22.12+
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [Shopify Partners](https://partners.shopify.com) account
- Development store

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Link to your Shopify app (creates client_id in shopify.app.toml)
shopify app config link

# 4. Set up database
npx prisma migrate dev --name init

# 5. Start development server
shopify app dev
```

Press **P** in the terminal to open the app in your development store.

---

## Project Structure

```
appstore/
├── app/
│   ├── routes/           # Admin pages, webhooks, auth, proxy
│   ├── services/         # Business logic (membership, billing, sync)
│   ├── lib/              # Validation, security, constants
│   ├── db.server.ts      # Prisma client
│   └── shopify.server.ts # Shopify app config
├── prisma/
│   └── schema.prisma     # Database models
├── extensions/
│   └── member-portal/    # Theme app extension
├── shopify.app.toml      # App configuration
└── package.json
```

---

## Configuration

Edit `.env` for your environment:

| Variable | Description |
|----------|-------------|
| `SHOPIFY_API_KEY` | From Partners Dashboard |
| `SHOPIFY_API_SECRET` | From Partners Dashboard |
| `SHOPIFY_APP_URL` | Set automatically by CLI |
| `DATABASE_URL` | SQLite (dev) or PostgreSQL (prod) |
| `BILLING_AMOUNT` | Monthly charge for merchants |
| `BILLING_TRIAL_DAYS` | Free trial period |

### Production Database

For production, switch to PostgreSQL in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

---

## App Store Submission Checklist

- [ ] Create app listing in Shopify Partners
- [ ] Add app icon (1200×1200 PNG)
- [ ] Write app description and screenshots
- [ ] Set pricing in Billing API config
- [ ] Test on development store
- [ ] Verify GDPR webhooks work
- [ ] Deploy: `shopify app deploy`
- [ ] Submit for review

### Required for App Store Review
1. **Privacy policy** — available at `/privacy`
2. **GDPR webhooks** — all three compliance topics configured
3. **Billing** — merchants must be charged via Shopify Billing API
4. **Embedded app** — runs inside Shopify admin
5. **OAuth** — proper session handling

---

## Deployment

```bash
# Build
npm run build

# Deploy to Shopify
shopify app deploy

# Production start
npm run setup && npm start
```

Recommended hosting: [Fly.io](https://fly.io), [Railway](https://railway.app), or [Heroku](https://heroku.com) with PostgreSQL.

---

## API Scopes Used

The app requests scopes needed for membership management:
- `read/write_customers` — member enrollment and tags
- `read/write_products` — exclusive product access
- `read_orders` — loyalty points on purchase
- `read/write_discounts` — member discount codes
- `read/write_metaobjects` — extended member data

---

## License

MIT — Built for Shopify App Store distribution.
