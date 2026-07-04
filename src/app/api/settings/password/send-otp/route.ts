import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { sendOtp } from "@/server/services/auth-service";
import { getClientIp } from "@/server/services/auth-audit";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";

async function getUserPhone(userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.user.findById(userId)?.phone ?? null;
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { phone: true },
  });
  return user?.phone ?? null;
}

export const POST = withAuth(async (userId, request) => {
  const phone = await getUserPhone(userId);
  if (!phone) return jsonOk({ error: "کاربر یافت نشد" }, 404);

  const result = await sendOtp(phone, getClientIp(request), false, undefined, "password_reset");
  return jsonOk({
    success: true,
    phone: result.phone,
    expiresAt: result.expiresAt,
    mockCode: result.mockCode,
  });
});
