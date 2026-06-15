import { z } from "zod";

export const membershipPlanSchema = z.object({
  name: z.string().min(1, "Plan name is required").max(100),
  description: z.string().max(500).optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens"),
  price: z.coerce.number().min(0, "Price must be positive"),
  currency: z.string().length(3).default("USD"),
  billingInterval: z.enum(["monthly", "quarterly", "yearly", "lifetime"]),
  trialDays: z.coerce.number().int().min(0).max(365).default(0),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  freeShipping: z.coerce.boolean().default(false),
  earlyAccess: z.coerce.boolean().default(false),
  exclusiveAccess: z.coerce.boolean().default(false),
  loyaltyMultiplier: z.coerce.number().min(1).max(10).default(1),
  maxMembers: z.coerce.number().int().positive().optional().nullable(),
  benefits: z.array(z.string()).default([]),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
  isActive: z.coerce.boolean().default(true),
});

export const memberUpdateSchema = z.object({
  planId: z.string().optional().nullable(),
  status: z.enum(["active", "paused", "cancelled", "expired", "pending"]).optional(),
  notes: z.string().max(1000).optional(),
  loyaltyPoints: z.coerce.number().int().min(0).optional(),
});

export const loyaltySettingsSchema = z.object({
  name: z.string().min(1).max(100),
  pointsPerDollar: z.coerce.number().min(0.1).max(100),
  signupBonus: z.coerce.number().int().min(0).max(10000),
  referralBonus: z.coerce.number().int().min(0).max(10000),
  reviewBonus: z.coerce.number().int().min(0).max(1000),
  birthdayBonus: z.coerce.number().int().min(0).max(1000),
  isActive: z.coerce.boolean(),
});

export const shopSettingsSchema = z.object({
  welcomeEmail: z.coerce.boolean().default(true),
  autoEnrollOnPurchase: z.coerce.boolean().default(true),
  showMemberBadge: z.coerce.boolean().default(true),
  portalEnabled: z.coerce.boolean().default(true),
  referralEnabled: z.coerce.boolean().default(true),
  loyaltyEnabled: z.coerce.boolean().default(true),
});

export function parseFormData<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): z.infer<T> {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key in raw) {
      const existing = raw[key];
      raw[key] = Array.isArray(existing)
        ? [...existing, value]
        : [existing, value];
    } else {
      raw[key] = value;
    }
  }
  return schema.parse(raw);
}

export function sanitizeString(input: string, maxLength = 255): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, "");
}
