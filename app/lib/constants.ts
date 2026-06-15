export const MEMBER_STATUSES = {
  ACTIVE: "active",
  PAUSED: "paused",
  CANCELLED: "cancelled",
  EXPIRED: "expired",
  PENDING: "pending",
} as const;

export const BILLING_INTERVALS = {
  MONTHLY: "monthly",
  QUARTERLY: "quarterly",
  YEARLY: "yearly",
  LIFETIME: "lifetime",
} as const;

export const LOYALTY_TRANSACTION_TYPES = {
  EARN: "earn",
  REDEEM: "redeem",
  BONUS: "bonus",
  REFERRAL: "referral",
  ADJUSTMENT: "adjustment",
  EXPIRE: "expire",
} as const;

export const REFERRAL_STATUSES = {
  PENDING: "pending",
  COMPLETED: "completed",
  REWARDED: "rewarded",
  EXPIRED: "expired",
} as const;

export const APP_BILLING_PLANS = {
  STARTER: { name: "Starter", price: 19.99, members: 500, features: ["basic_plans", "member_management"] },
  GROWTH: { name: "Growth", price: 49.99, members: 5000, features: ["basic_plans", "member_management", "loyalty", "referrals", "analytics"] },
  ENTERPRISE: { name: "Enterprise", price: 99.99, members: -1, features: ["all"] },
} as const;

export const DEFAULT_PLAN_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6",
];

export const MEMBER_TAG_PREFIX = "membervault";
