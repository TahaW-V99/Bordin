import {
  AdminConfigKey,
  CoinTransactionType,
  NotificationCategory,
  NotificationType,
  XpTransactionType,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import {
  INVITE_DEFAULT_COIN_REWARD,
  INVITE_DEFAULT_MAX_FRIENDS,
  INVITE_DEFAULT_XP_REWARD,
  INVITE_REFERRER_NOTIFICATION_BODY_FA,
  buildInviteShareLoginUrl,
  buildInviteShareMessage,
  isInviteUnlimitedRewardPromoActive,
} from "@/shared/constants/invite";
import { addSystemRewardCoins, addXpWithLevelUp } from "@/server/services/wallet-service";
import { createNotification } from "@/server/services/notification-service";

export type InviteSettings = {
  maxInvites: number;
  coinReward: number;
  xpReward: number;
};

function canRewardInvite(rewardedInviteCount: number, maxInvites: number) {
  return isInviteUnlimitedRewardPromoActive() || rewardedInviteCount < maxInvites;
}

export async function getInviteSettings(): Promise<InviteSettings> {
  if (await shouldUseMemoryDb()) {
    return {
      maxInvites: INVITE_DEFAULT_MAX_FRIENDS,
      coinReward: INVITE_DEFAULT_COIN_REWARD,
      xpReward: INVITE_DEFAULT_XP_REWARD,
    };
  }

  const keys = [
    AdminConfigKey.INVITE_MAX_FRIENDS,
    AdminConfigKey.INVITE_COIN_REWARD,
    AdminConfigKey.INVITE_XP_REWARD,
  ] as const;

  const rows = await prisma.adminConfig.findMany({
    where: { key: { in: [...keys] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    maxInvites: Number(map.get(AdminConfigKey.INVITE_MAX_FRIENDS) ?? INVITE_DEFAULT_MAX_FRIENDS),
    coinReward: Number(map.get(AdminConfigKey.INVITE_COIN_REWARD) ?? INVITE_DEFAULT_COIN_REWARD),
    xpReward: Number(map.get(AdminConfigKey.INVITE_XP_REWARD) ?? INVITE_DEFAULT_XP_REWARD),
  };
}

export function normalizeReferralCode(code: string) {
  return code.trim();
}

export async function resolveInviterByReferralCode(code: string) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.user.findByUsername(normalized);
  }

  return prisma.user.findFirst({
    where: { username: { equals: normalized } },
    select: { id: true, username: true, phone: true },
  });
}

export async function countSuccessfulInvites(inviterId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.invites.countForUser(inviterId);
  }
  return prisma.inviteLog.count({ where: { inviterId } });
}

export async function getInviteInfoForUser(
  userId: string,
  username: string | null | undefined,
  origin?: string,
) {
  const settings = await getInviteSettings();
  const inviteCount = await countSuccessfulInvites(userId);
  const inviteCode = username ?? "";
  const inviteLink = inviteCode ? buildInviteShareLoginUrl(inviteCode, origin) : "";
  const shareText = inviteLink ? buildInviteShareMessage(inviteLink) : "";

  return {
    inviteCode,
    inviteLink,
    shareText,
    inviteCount,
    maxInvites: settings.maxInvites,
    coinReward: settings.coinReward,
    xpReward: settings.xpReward,
  };
}

export async function processReferralOnSignup(
  inviteeId: string,
  referralCode: string | null | undefined,
) {
  const normalized = normalizeReferralCode(referralCode ?? "");
  if (!normalized) return { processed: false as const };

  if (await shouldUseMemoryDb()) {
    const inviter = devMemoryDb.user.findByUsername(normalized);
    if (!inviter || inviter.id === inviteeId) return { processed: false as const };
    try {
      devMemoryDb.invites.record(inviter.id, inviteeId);
      const { tryAutoCompleteInviteMission } = await import(
        "@/server/services/mission-service"
      );
      void tryAutoCompleteInviteMission(inviter.id);
      void import("@/server/services/energy-service").then(({ applyInviteEnergyRecovery }) =>
        applyInviteEnergyRecovery(inviter.id),
      );
      return { processed: true as const };
    } catch {
      return { processed: false as const };
    }
  }

  const inviter = await resolveInviterByReferralCode(normalized);
  if (!inviter || inviter.id === inviteeId) return { processed: false as const };

  const existing = await prisma.inviteLog.findUnique({ where: { inviteeId } });
  if (existing) return { processed: false as const };

  const settings = await getInviteSettings();
  const rewardedInviteCount = await prisma.inviteLog.count({
    where: { inviterId: inviter.id, coinsAwarded: { gt: 0 } },
  });
  const inviterGetsReward = canRewardInvite(rewardedInviteCount, settings.maxInvites);

  await prisma.inviteLog.create({
    data: {
      inviterId: inviter.id,
      inviteeId,
      coinsAwarded: inviterGetsReward ? settings.coinReward : 0,
      xpAwarded: inviterGetsReward ? settings.xpReward : 0,
    },
  });

  await addSystemRewardCoins(
    inviteeId,
    settings.coinReward,
    CoinTransactionType.INVITE_REWARD,
    "پاداش ثبت‌نام با کد معرف",
  );
  await addXpWithLevelUp(
    inviteeId,
    settings.xpReward,
    XpTransactionType.INVITE,
    "پاداش ثبت‌نام با کد معرف",
  );

  if (inviterGetsReward) {
    await addSystemRewardCoins(
      inviter.id,
      settings.coinReward,
      CoinTransactionType.INVITE_REWARD,
      "پاداش دعوت دوست",
    );
    await addXpWithLevelUp(
      inviter.id,
      settings.xpReward,
      XpTransactionType.INVITE,
      "پاداش دعوت دوست",
    );

    await createNotification({
      userId: inviter.id,
      type: NotificationType.INVITE,
      category: NotificationCategory.MESSAGE,
      titleFa: "دعوت موفق",
      bodyFa: INVITE_REFERRER_NOTIFICATION_BODY_FA,
      link: "/invite",
    });
  }

  const { tryAutoCompleteInviteMission } = await import(
    "@/server/services/mission-service"
  );
  void tryAutoCompleteInviteMission(inviter.id);

  void import("@/server/services/energy-service").then(({ applyInviteEnergyRecovery }) =>
    applyInviteEnergyRecovery(inviter.id),
  );

  return { processed: true as const, inviterRewarded: inviterGetsReward };
}
