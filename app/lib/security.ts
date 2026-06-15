import prisma from "~/db.server";

const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || "100", 10);
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);

export async function checkRateLimit(
  key: string,
  maxRequests = MAX_REQUESTS,
  windowMs = WINDOW_MS,
): Promise<{ allowed: boolean; remaining: number }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + windowMs);

  const entry = await prisma.rateLimitEntry.findUnique({ where: { key } });

  if (!entry || entry.expiresAt < now) {
    await prisma.rateLimitEntry.upsert({
      where: { key },
      create: { key, count: 1, expiresAt },
      update: { count: 1, expiresAt },
    });
    return { allowed: true, remaining: maxRequests - 1 };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0 };
  }

  await prisma.rateLimitEntry.update({
    where: { key },
    data: { count: entry.count + 1 },
  });

  return { allowed: true, remaining: maxRequests - entry.count - 1 };
}

export async function cleanupExpiredRateLimits(): Promise<void> {
  await prisma.rateLimitEntry.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function logAuditEvent(params: {
  shopId: string;
  action: string;
  entity: string;
  entityId?: string;
  actor?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      shopId: params.shopId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      actor: params.actor,
      details: JSON.stringify(params.details || {}),
      ipAddress: params.ipAddress,
    },
  });
}

export function generateReferralCode(firstName?: string | null): string {
  const prefix = (firstName || "MEMBER").slice(0, 4).toUpperCase().replace(/[^A-Z]/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${random}`;
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}
