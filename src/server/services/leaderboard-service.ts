import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { userNeedsDisplayName } from "@/shared/lib/kandakator-utils";
import { isLegacyInvitePlaceholderUser } from "@/shared/lib/legacy-invite-placeholder";
import { ensureUserShowcaseSlug } from "@/server/services/showcase-slug-service";
import type { GlobalLeaderboardEntry } from "@/shared/types/leaderboard";

export { getTeamLeaderboard, getTeamLeaderboardRank } from "@/server/services/team-leaderboard-service";

function isEligibleForLeaderboard(
  phone: string,
  displayName: string | null | undefined,
  username?: string | null,
) {
  if (isLegacyInvitePlaceholderUser({ phone, displayName, username })) return false;
  return !userNeedsDisplayName(phone, displayName);
}

async function buildEligibleGlobalLeaderboard(): Promise<GlobalLeaderboardEntry[]> {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.leaderboard.global();
  }

  const profiles = await prisma.userProfile.findMany({
    orderBy: { totalXp: "desc" },
    include: {
      user: { select: { username: true, phone: true } },
      currentLevel: true,
    },
  });

  const eligible = profiles.filter((p) =>
    isEligibleForLeaderboard(p.user.phone, p.displayName, p.user.username),
  );
  const eligibleUserIds = eligible.map((p) => p.userId);

  const medals =
    eligibleUserIds.length > 0
      ? await prisma.userMedal.groupBy({
          by: ["userId"],
          where: { userId: { in: eligibleUserIds } },
          _count: { id: true },
        })
      : [];
  const medalMap = new Map(medals.map((m) => [m.userId, m._count.id]));

  await Promise.all(
    eligible.filter((p) => !p.showcaseSlug).map((p) => ensureUserShowcaseSlug(p.userId)),
  );

  const profilesWithSlugs = await prisma.userProfile.findMany({
    where: { userId: { in: eligibleUserIds } },
    select: { userId: true, showcaseSlug: true },
  });
  const slugMap = new Map(profilesWithSlugs.map((p) => [p.userId, p.showcaseSlug]));

  return eligible.map((p, i) => ({
    rank: i + 1,
    userId: p.userId,
    username: p.user.username ?? "",
    displayName: p.displayName ?? p.user.username ?? "",
    avatarUrl: p.avatarUrl,
    showcaseSlug: slugMap.get(p.userId) ?? p.showcaseSlug,
    totalXp: p.totalXp,
    level: p.currentLevel?.nameFa ?? "",
    medalCount: medalMap.get(p.userId) ?? 0,
  }));
}

export async function getGlobalLeaderboard(): Promise<GlobalLeaderboardEntry[]> {
  const all = await buildEligibleGlobalLeaderboard();
  return all.slice(0, 100);
}

export async function getEligibleGlobalRankForUser(userId: string): Promise<number | null> {
  const all = await buildEligibleGlobalLeaderboard();
  return all.find((row) => row.userId === userId)?.rank ?? null;
}

export async function getGlobalLeaderboardForUser(userId: string) {
  const all = await buildEligibleGlobalLeaderboard();
  const leaderboard = all.slice(0, 100);
  const entry = all.find((row) => row.userId === userId);

  let needsDisplayName = true;
  if (await shouldUseMemoryDb()) {
    const profile = devMemoryDb.profile.getByUserId(userId);
    const user = devMemoryDb.user.findById(userId);
    needsDisplayName = !user || userNeedsDisplayName(user.phone, profile?.displayName);
  } else {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: { select: { displayName: true } } },
    });
    needsDisplayName = !user || userNeedsDisplayName(user.phone, user.profile?.displayName);
  }

  return {
    leaderboard,
    currentUserId: userId,
    currentUserRank: needsDisplayName ? null : (entry?.rank ?? null),
    needsDisplayName,
  };
}

export async function getTournamentLeaderboard(tournamentId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.leaderboard.tournament(tournamentId);
  }

  const entries = await prisma.tournamentEntry.findMany({
    where: { tournamentId },
    orderBy: { totalPoints: "desc" },
    take: 100,
    include: {
      user: {
        include: { profile: { include: { currentLevel: true } } },
      },
    },
  });

  return entries.map((e, i) => ({
    rank: i + 1,
    userId: e.userId,
    username: e.user.username ?? "",
    displayName: e.user.profile?.displayName ?? e.user.username ?? "",
    totalPoints: e.totalPoints,
    level: e.user.profile?.currentLevel?.nameFa ?? "",
  }));
}

