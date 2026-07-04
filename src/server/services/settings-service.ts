import { deductCoinsWithType } from "@/server/services/wallet-service";
import { setUserPassword, verifyOtpForUser } from "@/server/services/auth-service";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { ensureMemoryUser } from "@/server/ensure-memory-user";
import {
  DISPLAY_NAME_CHANGE_COST,
  DEFAULT_AVATAR_ID,
  AVATAR_PURCHASE_COST,
  getAvatarSrc,
  isValidAvatarId,
  isPremiumAvatarId,
} from "@/shared/constants/settings";
import {
  DISPLAY_NAME_TAKEN_ERROR_FA,
  validateDisplayName,
} from "@/shared/lib/display-name";
import { CoinTransactionType } from "@prisma/client";
function validatePassword(password: string) {
  if (password.length < 6) {
    throw new Error("رمز عبور باید حداقل ۶ کاراکتر باشد");
  }
}

export async function getUnlockedAvatarIds(userId: string): Promise<string[]> {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.profile.getUnlockedAvatarIds(userId);
  }

  const rows = await prisma.userUnlockedProfileAvatar.findMany({
    where: { userId },
    select: { avatarId: true },
  });
  return rows.map((row) => row.avatarId);
}

async function isAvatarUnlocked(userId: string, avatarId: string) {
  if (!isPremiumAvatarId(avatarId)) return true;
  const unlocked = await getUnlockedAvatarIds(userId);
  return unlocked.includes(avatarId);
}

async function assertAvatarSelectable(userId: string, avatarId: string) {
  if (!isValidAvatarId(avatarId)) {
    throw new Error("آواتار انتخاب‌شده معتبر نیست");
  }
  if (isPremiumAvatarId(avatarId) && !(await isAvatarUnlocked(userId, avatarId))) {
    throw new Error("این آواتار پریمیوم قفل است. ابتدا آن را خریداری کنید.");
  }
}

export async function getSettings(userId: string) {
  if (await shouldUseMemoryDb()) {
    const user = (await ensureMemoryUser(userId)) ?? devMemoryDb.user.findById(userId);
    const profile = devMemoryDb.profile.getByUserId(user?.id ?? userId);
    const wallet = devMemoryDb.wallet.getByUserId(user?.id ?? userId);
    if (!user || !profile) return null;

    const totalCoins =
      (wallet?.predictionRewardCoins ?? 0) +
      (wallet?.systemRewardCoins ?? 0) +
      (wallet?.purchasedCoins ?? 0);

    const changeCount = profile.displayNameChangeCount ?? 0;
    const unlockedAvatarIds = devMemoryDb.profile.getUnlockedAvatarIds(user?.id ?? userId);

    return {
      phone: user.phone,
      displayName: profile.displayName ?? user.phone,
      displayNameChangeCount: changeCount,
      nextNameChangeCost: changeCount === 0 ? 0 : DISPLAY_NAME_CHANGE_COST,
      avatarUrl: profile.avatarUrl,
      avatarSrc: getAvatarSrc(profile.avatarUrl),
      hasPassword: Boolean(user.passwordHash),
      totalCoins,
      unlockedAvatarIds,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, wallet: true },
  });
  if (!user?.profile) return null;

  const totalCoins =
    (user.wallet?.predictionRewardCoins ?? 0) +
    (user.wallet?.systemRewardCoins ?? 0) +
    (user.wallet?.purchasedCoins ?? 0);

  const changeCount = user.profile.displayNameChangeCount;
  const unlockedAvatarIds = await getUnlockedAvatarIds(userId);

  return {
    phone: user.phone,
    displayName: user.profile.displayName ?? user.phone,
    displayNameChangeCount: changeCount,
    nextNameChangeCost: changeCount === 0 ? 0 : DISPLAY_NAME_CHANGE_COST,
    avatarUrl: user.profile.avatarUrl,
    avatarSrc: getAvatarSrc(user.profile.avatarUrl),
    hasPassword: Boolean(user.passwordHash),
    totalCoins,
    unlockedAvatarIds,
  };
}

export async function isDisplayNameTaken(displayName: string, excludeUserId: string) {
  if (await shouldUseMemoryDb()) {
    for (const profile of devMemoryDb.profile.getAll()) {
      if (profile.userId === excludeUserId) continue;
      if (profile.displayName?.trim() === displayName) return true;
    }
    return false;
  }

  const existing = await prisma.userProfile.findFirst({
    where: {
      displayName,
      userId: { not: excludeUserId },
    },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function checkDisplayNameAvailability(userId: string, rawName: string) {
  const displayName = validateDisplayName(rawName);
  const taken = await isDisplayNameTaken(displayName, userId);
  return { displayName, available: !taken };
}

export async function updateDisplayName(userId: string, rawName: string) {
  const displayName = validateDisplayName(rawName);

  if (await isDisplayNameTaken(displayName, userId)) {
    throw new Error(DISPLAY_NAME_TAKEN_ERROR_FA);
  }

  if (await shouldUseMemoryDb()) {
    const profile = devMemoryDb.profile.getByUserId(userId);
    if (!profile) throw new Error("پروفایل یافت نشد");

    if (profile.displayName === displayName) {
      throw new Error("نام جدید با نام فعلی یکسان است");
    }

    const changeCount = profile.displayNameChangeCount ?? 0;
    let coinsDeducted = 0;

    if (changeCount > 0) {
      await deductCoinsWithType(
        userId,
        DISPLAY_NAME_CHANGE_COST,
        CoinTransactionType.PROFILE_NAME_CHANGE,
        "تغییر نام نمایشی",
      );
      coinsDeducted = DISPLAY_NAME_CHANGE_COST;
    }

    devMemoryDb.profile.updateDisplayName(userId, displayName, changeCount + 1);

    const { refreshUserGlobalRank } = await import("@/server/services/leaderboard-rank-service");
    await refreshUserGlobalRank(userId);

    return {
      displayName,
      displayNameChangeCount: changeCount + 1,
      coinsDeducted,
      nextNameChangeCost: DISPLAY_NAME_CHANGE_COST,
    };
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("پروفایل یافت نشد");

  if (profile.displayName === displayName) {
    throw new Error("نام جدید با نام فعلی یکسان است");
  }

  const changeCount = profile.displayNameChangeCount;
  let coinsDeducted = 0;

  if (changeCount > 0) {
    await deductCoinsWithType(
      userId,
      DISPLAY_NAME_CHANGE_COST,
      CoinTransactionType.PROFILE_NAME_CHANGE,
      "تغییر نام نمایشی",
    );
    coinsDeducted = DISPLAY_NAME_CHANGE_COST;
  }

  await prisma.userProfile.update({
    where: { userId },
    data: {
      displayName,
      displayNameChangeCount: changeCount + 1,
    },
  });

  const { refreshUserGlobalRank } = await import("@/server/services/leaderboard-rank-service");
  await refreshUserGlobalRank(userId);

  return {
    displayName,
    displayNameChangeCount: changeCount + 1,
    coinsDeducted,
    nextNameChangeCost: DISPLAY_NAME_CHANGE_COST,
  };
}

export async function updateAvatar(userId: string, avatarId: string) {
  await assertAvatarSelectable(userId, avatarId);

  if (await shouldUseMemoryDb()) {
    devMemoryDb.profile.updateAvatar(userId, avatarId);
  } else {
    await prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl: avatarId },
    });
  }

  return {
    avatarUrl: avatarId,
    avatarSrc: getAvatarSrc(avatarId),
  };
}

export async function purchaseAvatar(userId: string, avatarId: string) {
  if (!isValidAvatarId(avatarId)) {
    throw new Error("آواتار انتخاب‌شده معتبر نیست");
  }
  if (!isPremiumAvatarId(avatarId)) {
    throw new Error("این آواتار رایگان است و نیازی به خرید ندارد");
  }

  if (await isAvatarUnlocked(userId, avatarId)) {
    return updateAvatar(userId, avatarId);
  }

  if (await shouldUseMemoryDb()) {
    await deductCoinsWithType(
      userId,
      AVATAR_PURCHASE_COST,
      CoinTransactionType.PROFILE_AVATAR_PURCHASE,
      "خرید آواتار پروفایل",
    );
    devMemoryDb.profile.unlockAvatar(userId, avatarId);
    devMemoryDb.profile.updateAvatar(userId, avatarId);

    return {
      avatarUrl: avatarId,
      avatarSrc: getAvatarSrc(avatarId),
      coinsDeducted: AVATAR_PURCHASE_COST,
      unlockedAvatarIds: devMemoryDb.profile.getUnlockedAvatarIds(userId),
    };
  }

  const existing = await prisma.userUnlockedProfileAvatar.findUnique({
    where: { userId_avatarId: { userId, avatarId } },
  });
  if (existing) {
    return updateAvatar(userId, avatarId);
  }

  await deductCoinsWithType(
    userId,
    AVATAR_PURCHASE_COST,
    CoinTransactionType.PROFILE_AVATAR_PURCHASE,
    "خرید آواتار پروفایل",
  );

  await prisma.$transaction([
    prisma.userUnlockedProfileAvatar.create({
      data: { userId, avatarId },
    }),
    prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl: avatarId },
    }),
  ]);

  const unlockedAvatarIds = await getUnlockedAvatarIds(userId);

  return {
    avatarUrl: avatarId,
    avatarSrc: getAvatarSrc(avatarId),
    coinsDeducted: AVATAR_PURCHASE_COST,
    unlockedAvatarIds,
  };
}

export async function setInitialPassword(userId: string, password: string) {
  validatePassword(password);

  if (await shouldUseMemoryDb()) {
    const user = devMemoryDb.user.findById(userId);
    if (!user) throw new Error("کاربر یافت نشد");
    if (user.passwordHash) {
      throw new Error("رمز عبور قبلاً تنظیم شده. برای تغییر از بخش تغییر رمز استفاده کنید.");
    }
  } else {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("کاربر یافت نشد");
    if (user.passwordHash) {
      throw new Error("رمز عبور قبلاً تنظیم شده. برای تغییر از بخش تغییر رمز استفاده کنید.");
    }
    await setUserPassword(userId, password, user.phone);
    return { success: true };
  }

  await setUserPassword(userId, password);
  return { success: true };
}

export async function changePasswordWithOtp(
  userId: string,
  code: string,
  password: string,
) {
  validatePassword(password);

  let phone: string;
  if (await shouldUseMemoryDb()) {
    const user = devMemoryDb.user.findById(userId);
    if (!user?.passwordHash) throw new Error("ابتدا رمز عبور را تنظیم کنید");
    phone = user.phone;
  } else {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user?.passwordHash) throw new Error("ابتدا رمز عبور را تنظیم کنید");
    phone = user.phone;
  }

  await verifyOtpForUser(phone, code);
  await setUserPassword(userId, password, phone);
  return { success: true };
}

export { DEFAULT_AVATAR_ID, DISPLAY_NAME_CHANGE_COST, AVATAR_PURCHASE_COST };
