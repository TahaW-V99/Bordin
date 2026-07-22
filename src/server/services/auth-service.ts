import bcrypt from "bcryptjs";
import { createHmac, timingSafeEqual } from "node:crypto";
import { AdminConfigKey, CoinTransactionType, CoinType, XpTransactionType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { createSession } from "@/shared/lib/auth";
import { isValidIranMobile, normalizePhone } from "@/shared/lib/phone";
import { devMemoryDb } from "@/server/dev-memory-db";
import { shouldUseMemoryDb } from "@/server/db";
import { ensureMemoryUser } from "@/server/ensure-memory-user";
import { buildShowcaseSlugForNewUser } from "@/server/services/showcase-slug-service";
import { reconcileSessionUser, resolveDbUser } from "@/server/ensure-db-user";
import { isPrismaRecordNotFound } from "@/shared/lib/api-errors";
import {
  countOtpSendsInWindow,
  logAuthEvent,
} from "@/server/services/auth-audit";
import { deliverOtpCode } from "@/server/services/sms-service";
import { shouldUseMockOtp } from "@/server/config/sms-config";
import type { SmsOtpTemplateKey } from "@/server/services/sms/types";
import {
  OTP_TTL_MS,
  MAX_OTP_VERIFY_ATTEMPTS,
  OTP_RATE_LIMIT_WINDOW_MS,
  MAX_OTP_SENDS_PER_WINDOW,
  MAX_PASSWORD_ATTEMPTS,
  PASSWORD_LOCK_MS,
  FIXED_OTP_BY_PHONE,
} from "@/shared/constants/auth";

const SIGNUP_BONUS_XP = 50;
const OTP_HASH_PREFIX = "otp1:";

export {
  OTP_TTL_MS,
  MAX_OTP_VERIFY_ATTEMPTS,
  OTP_RATE_LIMIT_WINDOW_MS,
  MAX_OTP_SENDS_PER_WINDOW,
  MAX_PASSWORD_ATTEMPTS,
  PASSWORD_LOCK_MS,
};

function generateOtp(phone: string) {
  const fixed = FIXED_OTP_BY_PHONE[phone];
  if (fixed) return fixed;
  if (shouldUseMockOtp()) {
    return "123456";
  }
  return String(Math.floor(100000 + Math.random() * 900000));
}

function hashOtp(code: string) {
  const secret = process.env.JWT_SECRET ?? "bordin-otp-fallback";
  const digest = createHmac("sha256", secret).update(`otp:${code}`).digest("hex");
  return `${OTP_HASH_PREFIX}${digest}`;
}

async function verifyOtpHash(code: string, hash: string) {
  if (hash.startsWith("$2")) {
    return bcrypt.compare(code, hash);
  }
  const expected = hashOtp(code);
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(hash, "utf8"));
  } catch {
    return false;
  }
}

async function assertOtpRateLimit(phone: string) {
  const count = await countOtpSendsInWindow(phone);
  if (count >= MAX_OTP_SENDS_PER_WINDOW) {
    const minutes = Math.ceil(OTP_RATE_LIMIT_WINDOW_MS / 60_000);
    throw new Error(
      `تعداد درخواست کد بیش از حد مجاز است. لطفاً ${minutes} دقیقه دیگر دوباره تلاش کنید.`,
    );
  }
}

async function persistOtpSession(
  phone: string,
  code: string,
  expiresAt: Date,
  referralCode?: string | null,
  useMemory?: boolean,
) {
  const normalizedReferral = referralCode?.trim() || null;
  const memory = useMemory ?? (await shouldUseMemoryDb());
  if (memory) {
    const codeHash = hashOtp(code);
    devMemoryDb.otp.deleteMany(phone);
    devMemoryDb.otp.create(phone, codeHash, expiresAt, normalizedReferral);
    return;
  }

  const codeHash = hashOtp(code);
  await prisma.otpSession.deleteMany({ where: { phone } });
  await prisma.otpSession.create({
    data: { phone, codeHash, expiresAt, referralCode: normalizedReferral },
  });
}

export async function sendOtp(
  phone: string,
  ip?: string | null,
  isResend = false,
  referralCode?: string | null,
  smsTemplate: SmsOtpTemplateKey = "login",
) {
  const normalized = normalizePhone(phone);
  if (!isValidIranMobile(normalized)) {
    throw new Error("شماره موبایل معتبر نیست");
  }

  const code = generateOtp(normalized);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const event = isResend ? "OTP_RESENT" : "OTP_SENT";
  const isFixedOtpPhone = Boolean(FIXED_OTP_BY_PHONE[normalized]);
  const useMockOtp = shouldUseMockOtp();
  const useMemory = await shouldUseMemoryDb();

  if (isFixedOtpPhone || useMockOtp) {
    await assertOtpRateLimit(normalized);
    await persistOtpSession(normalized, code, expiresAt, referralCode, useMemory);
    await logAuthEvent(normalized, event, ip);
    console.log(`[Bordin OTP] ${normalized}: ${code}`);
  } else {
    const startedAt = Date.now();
    await Promise.all([
      deliverOtpCode(normalized, code, smsTemplate),
      assertOtpRateLimit(normalized).then(() =>
        persistOtpSession(normalized, code, expiresAt, referralCode, useMemory),
      ),
    ]);
    console.info("[Bordin OTP] pipeline", {
      ms: Date.now() - startedAt,
      phone: `${normalized.slice(0, 4)}***`,
    });
    void logAuthEvent(normalized, event, ip);
  }

  return {
    phone: normalized,
    expiresAt: expiresAt.toISOString(),
    mockCode:
      useMockOtp || isFixedOtpPhone ? code : undefined,
  };
}

export async function resendOtp(
  phone: string,
  ip?: string | null,
  referralCode?: string | null,
) {
  return sendOtp(phone, ip, true, referralCode);
}

export async function invalidateOtp(phone: string, ip?: string | null) {
  const normalized = normalizePhone(phone);
  if (await shouldUseMemoryDb()) {
    devMemoryDb.otp.deleteMany(normalized);
  } else {
    await prisma.otpSession.deleteMany({ where: { phone: normalized } });
  }
  await logAuthEvent(normalized, "OTP_INVALIDATED", ip);
}

export async function checkPhoneAuthOptions(phone: string) {
  const normalized = normalizePhone(phone);
  if (!isValidIranMobile(normalized)) {
    throw new Error("شماره موبایل معتبر نیست");
  }

  if (await shouldUseMemoryDb()) {
    const user = devMemoryDb.user.findByPhone(normalized);
    return {
      phone: normalized,
      exists: Boolean(user),
      hasPassword: Boolean(user?.passwordHash),
    };
  }

  const user = await prisma.user.findUnique({
    where: { phone: normalized },
    select: { passwordHash: true },
  });

  return {
    phone: normalized,
    exists: Boolean(user),
    hasPassword: Boolean(user?.passwordHash),
  };
}

async function finalizeLogin(
  userId: string,
  phone: string,
  isNewUser: boolean,
  onboardingComplete: boolean,
) {
  await createSession({ userId, phone });
  return {
    userId,
    phone,
    isNewUser,
    needsOnboarding: !onboardingComplete,
  };
}

async function createNewUser(normalized: string) {
  if (await shouldUseMemoryDb()) {
    const user = devMemoryDb.user.create(normalized);
    const { ensureWelcomeNotification } = await import("@/server/services/notification-service");
    await ensureWelcomeNotification(user.id);
    try {
      const { ensureUserEnergy } = await import("@/server/services/energy-service");
      await ensureUserEnergy(user.id);
    } catch {
      // ignore in memory mode
    }
    return {
      id: user.id,
      phone: user.phone,
      onboardingComplete: user.onboardingComplete,
    };
  }

  const signupBonusConfig = await prisma.adminConfig.findUnique({
    where: { key: AdminConfigKey.SIGNUP_BONUS_COINS },
  });
  const signupBonus = (signupBonusConfig?.value as number) ?? 900;
  const firstLevel = await prisma.level.findFirst({ orderBy: { rank: "asc" } });

  const user = await prisma.user.create({
    data: {
      phone: normalized,
      username: `user_${normalized.slice(-4)}_${Date.now().toString(36).slice(-4)}`,
      profile: {
        create: {
          displayName: normalized,
          avatarUrl: "avatar-01",
          displayNameChangeCount: 0,
          currentLevelId: firstLevel?.id,
          totalXp: SIGNUP_BONUS_XP,
          showcaseSlug: buildShowcaseSlugForNewUser(normalized),
        },
      },
      wallet: {
        create: { systemRewardCoins: signupBonus },
      },
    },
  });

  const wallet = await prisma.coinWallet.findUnique({ where: { userId: user.id } });
  if (wallet) {
    await prisma.coinTransaction.create({
      data: {
        walletId: wallet.id,
        coinType: CoinType.SYSTEM_REWARD,
        amount: signupBonus,
        balanceAfter: signupBonus,
        type: CoinTransactionType.SIGNUP_BONUS,
        description: "پاداش ثبت‌نام",
      },
    });
  }

  await prisma.xpTransaction.create({
    data: {
      userId: user.id,
      amount: SIGNUP_BONUS_XP,
      type: XpTransactionType.MISSION,
      description: "پاداش ثبت‌نام",
    },
  });

  const { refreshUserGlobalRank } = await import("@/server/services/leaderboard-rank-service");
  await refreshUserGlobalRank(user.id);

  const { ensureWelcomeNotification } = await import("@/server/services/notification-service");
  await ensureWelcomeNotification(user.id);

  try {
    const { applyPendingLegacyImportForPhone } = await import(
      "@/server/services/legacy-user-import-service"
    );
    await applyPendingLegacyImportForPhone(user.id, normalized);
  } catch (error) {
    console.error("[legacy-import] failed to apply pending data on signup", {
      phone: normalized,
      error: error instanceof Error ? error.message : error,
    });
  }

  try {
    const { ensureUserEnergy } = await import("@/server/services/energy-service");
    await ensureUserEnergy(user.id);
  } catch (error) {
    console.error("[energy] failed to initialize user energy on signup", {
      phone: normalized,
      error: error instanceof Error ? error.message : error,
    });
  }

  return {
    id: user.id,
    phone: user.phone,
    onboardingComplete: user.onboardingComplete,
  };
}

export async function verifyOtpAndLogin(
  phone: string,
  code: string,
  ip?: string | null,
) {
  const normalized = normalizePhone(phone);
  const useMemory = await shouldUseMemoryDb();

  if (useMemory) {
    const session = devMemoryDb.otp.findLatest(normalized);
    if (!session || session.expiresAt < new Date()) {
      await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "expired" });
      throw new Error("کد تأیید منقضی شده است. دوباره درخواست دهید.");
    }
    if (session.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "max_attempts" });
      throw new Error("تعداد تلاش‌ها بیش از حد مجاز است. لطفاً کد جدید بگیرید.");
    }
    const valid = await verifyOtpHash(code, session.codeHash);
    if (!valid) {
      devMemoryDb.otp.incrementAttempts(normalized);
      await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "wrong_code" });
      throw new Error("کد تأیید نادرست است");
    }

    const user = devMemoryDb.user.findByPhone(normalized);
    const isNewUser = !user;
    let userId: string;
    let onboardingComplete: boolean;

    if (!user) {
      const created = await createNewUser(normalized);
      userId = created.id;
      onboardingComplete = created.onboardingComplete;
      const { processReferralOnSignup } = await import("@/server/services/invite-service");
      await processReferralOnSignup(userId, session.referralCode);
    } else {
      devMemoryDb.user.updateLastLogin(user.id);
      userId = user.id;
      onboardingComplete = user.onboardingComplete;
    }
    devMemoryDb.otp.delete(normalized);
    await logAuthEvent(normalized, "OTP_VERIFY_SUCCESS", ip);

    return finalizeLogin(userId, normalized, isNewUser, onboardingComplete);
  }

  const session = await prisma.otpSession.findFirst({
    where: { phone: normalized },
    orderBy: { createdAt: "desc" },
  });

  if (!session || session.expiresAt < new Date()) {
    await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "expired" });
    throw new Error("کد تأیید منقضی شده است. دوباره درخواست دهید.");
  }

  if (session.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
    await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "max_attempts" });
    throw new Error("تعداد تلاش‌ها بیش از حد مجاز است. لطفاً کد جدید بگیرید.");
  }

  const valid = await verifyOtpHash(code, session.codeHash);
  if (!valid) {
    await prisma.otpSession.update({
      where: { id: session.id },
      data: { attempts: { increment: 1 } },
    });
    await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "wrong_code" });
    throw new Error("کد تأیید نادرست است");
  }

  const user = await prisma.user.findUnique({ where: { phone: normalized } });
  let isNewUser = !user;
  let userId: string;
  let onboardingComplete: boolean;
  let referralToProcess: string | null | undefined = session.referralCode;

  if (!user) {
    const created = await createNewUser(normalized);
    userId = created.id;
    onboardingComplete = created.onboardingComplete;
  } else {
    userId = user.id;
    onboardingComplete = user.onboardingComplete;
    referralToProcess = undefined;
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (error) {
      if (!isPrismaRecordNotFound(error)) throw error;
      const again = await prisma.user.findUnique({ where: { phone: normalized } });
      if (!again) {
        const created = await createNewUser(normalized);
        userId = created.id;
        onboardingComplete = created.onboardingComplete;
        isNewUser = true;
        referralToProcess = session.referralCode;
      } else {
        userId = again.id;
        onboardingComplete = again.onboardingComplete;
        await prisma.user.update({
          where: { id: again.id },
          data: { lastLoginAt: new Date() },
        });
      }
    }
  }

  if (isNewUser) {
    const { processReferralOnSignup } = await import("@/server/services/invite-service");
    await processReferralOnSignup(userId, referralToProcess);
  }

  await prisma.otpSession.deleteMany({ where: { phone: normalized } });
  await logAuthEvent(normalized, "OTP_VERIFY_SUCCESS", ip);

  return finalizeLogin(userId, normalized, isNewUser, onboardingComplete);
}

export async function verifyOtpForUser(
  phone: string,
  code: string,
  ip?: string | null,
) {
  const normalized = normalizePhone(phone);

  if (await shouldUseMemoryDb()) {
    const session = devMemoryDb.otp.findLatest(normalized);
    if (!session || session.expiresAt < new Date()) {
      await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "expired" });
      throw new Error("کد تأیید منقضی شده است. دوباره درخواست دهید.");
    }
    if (session.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
      await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "max_attempts" });
      throw new Error("تعداد تلاش‌ها بیش از حد مجاز است. لطفاً کد جدید بگیرید.");
    }
    const valid = await verifyOtpHash(code, session.codeHash);
    if (!valid) {
      devMemoryDb.otp.incrementAttempts(normalized);
      await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "wrong_code" });
      throw new Error("کد تأیید نادرست است");
    }
    devMemoryDb.otp.delete(normalized);
    await logAuthEvent(normalized, "OTP_VERIFY_SUCCESS", ip);
    return true;
  }

  const session = await prisma.otpSession.findFirst({
    where: { phone: normalized },
    orderBy: { createdAt: "desc" },
  });

  if (!session || session.expiresAt < new Date()) {
    await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "expired" });
    throw new Error("کد تأیید منقضی شده است. دوباره درخواست دهید.");
  }

  if (session.attempts >= MAX_OTP_VERIFY_ATTEMPTS) {
    await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "max_attempts" });
    throw new Error("تعداد تلاش‌ها بیش از حد مجاز است. لطفاً کد جدید بگیرید.");
  }

  const valid = await verifyOtpHash(code, session.codeHash);
  if (!valid) {
    await prisma.otpSession.update({
      where: { id: session.id },
      data: { attempts: { increment: 1 } },
    });
    await logAuthEvent(normalized, "OTP_VERIFY_FAIL", ip, { reason: "wrong_code" });
    throw new Error("کد تأیید نادرست است");
  }

  await prisma.otpSession.deleteMany({ where: { phone: normalized } });
  await logAuthEvent(normalized, "OTP_VERIFY_SUCCESS", ip);
  return true;
}

export async function loginWithPassword(
  phone: string,
  password: string,
  ip?: string | null,
) {
  const normalized = normalizePhone(phone);
  if (!password.trim()) {
    throw new Error("رمز عبور الزامی است");
  }

  const useMemory = await shouldUseMemoryDb();

  if (useMemory) {
    const user = devMemoryDb.user.findByPhone(normalized);
    if (!user?.passwordHash) {
      throw new Error("برای این شماره رمز عبور تنظیم نشده است. با کد پیامکی وارد شوید.");
    }
    if (user.passwordLockedUntil && user.passwordLockedUntil > new Date()) {
      throw new Error("حساب موقتاً قفل شده است. چند دقیقه دیگر دوباره تلاش کنید.");
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      devMemoryDb.user.incrementFailedPassword(user.id);
      await logAuthEvent(normalized, "PASSWORD_LOGIN_FAIL", ip);
      throw new Error("رمز عبور نادرست است");
    }
    devMemoryDb.user.resetFailedPassword(user.id);
    devMemoryDb.user.updateLastLogin(user.id);
    await logAuthEvent(normalized, "PASSWORD_LOGIN_SUCCESS", ip);
    return finalizeLogin(user.id, normalized, false, user.onboardingComplete);
  }

  const user = await prisma.user.findUnique({ where: { phone: normalized } });
  if (!user?.passwordHash) {
    throw new Error("برای این شماره رمز عبور تنظیم نشده است. با کد پیامکی وارد شوید.");
  }

  if (user.passwordLockedUntil && user.passwordLockedUntil > new Date()) {
    await logAuthEvent(normalized, "PASSWORD_LOCKED", ip);
    throw new Error("حساب موقتاً قفل شده است. چند دقیقه دیگر دوباره تلاش کنید.");
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const attempts = user.failedPasswordAttempts + 1;
    const lockUntil =
      attempts >= MAX_PASSWORD_ATTEMPTS
        ? new Date(Date.now() + PASSWORD_LOCK_MS)
        : null;

    const resolved = await resolveDbUser(user.id, normalized);
    if (resolved) {
      await prisma.user.update({
        where: { id: resolved.user.id },
        data: {
          failedPasswordAttempts: attempts,
          passwordLockedUntil: lockUntil,
        },
      });
    }

    await logAuthEvent(normalized, "PASSWORD_LOGIN_FAIL", ip, { attempts });

    if (lockUntil) {
      await logAuthEvent(normalized, "PASSWORD_LOCKED", ip);
      throw new Error("تعداد تلاش‌های ناموفق زیاد بود. حساب ۱۵ دقیقه قفل شد.");
    }
    throw new Error("رمز عبور نادرست است");
  }

  const resolved = await resolveDbUser(user.id, normalized);
  if (!resolved) {
    throw new Error("کاربر یافت نشد. لطفاً دوباره وارد شوید.");
  }

  await prisma.user.update({
    where: { id: resolved.user.id },
    data: {
      lastLoginAt: new Date(),
      failedPasswordAttempts: 0,
      passwordLockedUntil: null,
    },
  });

  if (resolved.sessionRefresh) {
    await createSession({ userId: resolved.user.id, phone: normalized });
  }

  await logAuthEvent(normalized, "PASSWORD_LOGIN_SUCCESS", ip);
  return finalizeLogin(
    resolved.user.id,
    normalized,
    false,
    resolved.user.onboardingComplete,
  );
}

export async function setUserPassword(userId: string, password: string, phone?: string) {
  const hash = await bcrypt.hash(password, 10);
  if (await shouldUseMemoryDb()) {
    devMemoryDb.user.setPassword(userId, hash);
    return;
  }
  const resolved = await resolveDbUser(userId, phone);
  if (!resolved) {
    throw new Error("کاربر یافت نشد. لطفاً دوباره وارد شوید.");
  }
  await prisma.user.update({
    where: { id: resolved.user.id },
    data: { passwordHash: hash },
  });
  if (resolved.sessionRefresh && phone) {
    await createSession({ userId: resolved.user.id, phone });
  }
}

export async function completeOnboarding(userId: string, phone?: string) {
  if (await shouldUseMemoryDb()) {
    await ensureMemoryUser(userId);
    const updated = devMemoryDb.user.setOnboardingComplete(userId);
    if (!updated) {
      throw new Error("کاربر یافت نشد. لطفاً دوباره وارد شوید.");
    }
    return;
  }

  const resolved = await resolveDbUser(userId, phone);
  if (!resolved) {
    throw new Error("کاربر یافت نشد. لطفاً دوباره وارد شوید.");
  }

  await prisma.user.update({
    where: { id: resolved.user.id },
    data: { onboardingComplete: true },
  });

  if (resolved.sessionRefresh && phone) {
    await createSession({ userId: resolved.user.id, phone });
  }
}

export async function getUserOnboardingStatus(userId: string, phone?: string) {
  if (await shouldUseMemoryDb()) {
    const user =
      (await ensureMemoryUser(userId)) ?? devMemoryDb.user.findById(userId);
    return user?.onboardingComplete ?? false;
  }

  const resolved = await resolveDbUser(userId, phone);
  if (!resolved) return false;

  return resolved.user.onboardingComplete;
}
