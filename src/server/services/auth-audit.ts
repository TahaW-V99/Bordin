import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { OTP_RATE_LIMIT_WINDOW_MS } from "@/shared/constants/auth";

export type AuthAuditEvent =
  | "OTP_SENT"
  | "OTP_RESENT"
  | "OTP_INVALIDATED"
  | "OTP_VERIFY_FAIL"
  | "OTP_VERIFY_SUCCESS"
  | "PASSWORD_LOGIN_FAIL"
  | "PASSWORD_LOGIN_SUCCESS"
  | "PASSWORD_LOCKED"
  | "OTP_RATE_LIMITED";

export async function logAuthEvent(
  phone: string,
  event: AuthAuditEvent,
  ip?: string | null,
  metadata?: Record<string, unknown>,
) {
  if (await shouldUseMemoryDb()) {
    devMemoryDb.audit.log(phone, event, ip, metadata);
    return;
  }
  await prisma.authAuditLog.create({
    data: {
      phone,
      event,
      ip: ip ?? undefined,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

export async function countOtpSendsInWindow(phone: string): Promise<number> {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.audit.countOtpSendsInWindow(phone);
  }
  const since = new Date(Date.now() - OTP_RATE_LIMIT_WINDOW_MS);
  return prisma.authAuditLog.count({
    where: {
      phone,
      event: { in: ["OTP_SENT", "OTP_RESENT"] },
      createdAt: { gte: since },
    },
  });
}

export function getClientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    null
  );
}
