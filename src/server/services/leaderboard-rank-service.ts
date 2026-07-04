import { NotificationCategory, NotificationType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { userNeedsDisplayName } from "@/shared/lib/kandakator-utils";
import { isLegacyInvitePlaceholderUser } from "@/shared/lib/legacy-invite-placeholder";
import { createNotification } from "@/server/services/notification-service";

function isEligibleForLeaderboard(
  phone: string,
  displayName: string | null | undefined,
  username?: string | null,
) {
  if (isLegacyInvitePlaceholderUser({ phone, displayName, username })) return false;
  return !userNeedsDisplayName(phone, displayName);
}

async function computeGlobalRankByXp(totalXp: number, userId: string) {
  if (await shouldUseMemoryDb()) {
    const profiles = devMemoryDb.profile
      .getAll()
      .filter((p) => {
        const user = devMemoryDb.user.findById(p.userId);
        return user && isEligibleForLeaderboard(user.phone, p.displayName, user.username);
      })
      .sort((a, b) => b.totalXp - a.totalXp);
    const index = profiles.findIndex((p) => p.userId === userId);
    return index >= 0 ? index + 1 : null;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: { select: { displayName: true } } },
  });
  if (
    !user?.profile ||
    !isEligibleForLeaderboard(user.phone, user.profile.displayName, user.username)
  ) {
    return null;
  }

  const higherProfiles = await prisma.userProfile.findMany({
    where: { totalXp: { gt: totalXp } },
    include: { user: { select: { phone: true, username: true } } },
  });
  const eligibleHigherCount = higherProfiles.filter((p) =>
    isEligibleForLeaderboard(p.user.phone, p.displayName, p.user.username),
  ).length;
  return eligibleHigherCount + 1;
}

async function notifyLeaderboardRankUp(userId: string) {
  await createNotification({
    userId,
    type: NotificationType.LEADERBOARD_RANK_UP,
    category: NotificationCategory.MESSAGE,
    titleFa: "ارتقای رتبه لیدر برد",
    bodyFa: "تبریک! رتبه‌ات در لیدر برد ارتقا پیدا کرده.",
    link: null,
    secondaryLink: "/leaderboard?tab=global&highlight=1",
    secondaryLinkLabelFa: "دیدن جایگاه",
  });
}

/** بعد از تغییر امتیاز، رتبه جهانی را به‌روز و در صورت ارتقا اعلان بفرست. */
export async function refreshUserGlobalRank(userId: string) {
  if (await shouldUseMemoryDb()) {
    const profile = devMemoryDb.profile.getByUserId(userId);
    const user = devMemoryDb.user.findById(userId);
    if (!profile || !user) return null;

    const newRank = await computeGlobalRankByXp(profile.totalXp, userId);
    const p = devMemoryDb.profile.getRaw(userId);
    if (p) {
      p.globalRank = newRank;
    }

    if (newRank !== null) {
      const previousRank = profile.globalRank;
      if (previousRank !== null && newRank < previousRank) {
        await notifyLeaderboardRankUp(userId);
      }
    }

    return newRank;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: { user: { select: { phone: true } } },
  });
  if (!profile) return null;

  const newRank = await computeGlobalRankByXp(profile.totalXp, userId);
  const previousRank = profile.globalRank;

  await prisma.userProfile.update({
    where: { userId },
    data: { globalRank: newRank },
  });

  if (newRank !== null && previousRank !== null && newRank < previousRank) {
    await notifyLeaderboardRankUp(userId);
  }

  return newRank;
}
