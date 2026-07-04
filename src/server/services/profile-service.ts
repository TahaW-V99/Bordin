import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { ensureMemoryUser } from "@/server/ensure-memory-user";
import { getEligibleGlobalRankForUser } from "@/server/services/leaderboard-service";
import { buildHonorsList } from "@/shared/lib/honors";
import { userNeedsDisplayName } from "@/shared/lib/kandakator-utils";
import { ensureDevTestMedalsForUser } from "@/server/services/dev-test-medals-service";
import { ensureUserShowcaseSlug } from "@/server/services/showcase-slug-service";
import type { PublicProfileData, PublicProfileStats, PublicProfileTeam } from "@/shared/types/public-profile";
import { isLegacyInvitePlaceholderUser } from "@/shared/lib/legacy-invite-placeholder";
import { teamLogoUrl } from "@/shared/constants/teams";

function buildPublicProfileStats(
  totalPredictions: number,
  perfectPredictions: number,
  cupsEntered: number,
  tournamentsEntered: number,
  teamCompetitionsEntered: number,
): PublicProfileStats {
  const accuracyPercent =
    totalPredictions > 0
      ? Math.round((perfectPredictions / totalPredictions) * 100)
      : null;

  return {
    totalPredictions,
    perfectPredictions,
    accuracyPercent,
    cupsEntered,
    tournamentsEntered,
    teamCompetitionsEntered,
  };
}

async function getUserTeamsForShowcase(userId: string): Promise<PublicProfileTeam[]> {
  if (await shouldUseMemoryDb()) {
    const cd = (
      globalThis as unknown as {
        __bordinDevDb?: {
          competitionData: {
            teams: Array<{
              id: string;
              name: string;
              logoUrl: string | null;
              members: Array<{ userId: string }>;
            }>;
          };
        };
      }
    ).__bordinDevDb?.competitionData;
    if (!cd) return [];
    return cd.teams
      .filter((team) => team.members.some((member) => member.userId === userId))
      .map((team) => ({
        id: team.id,
        name: team.name,
        logoUrl: team.logoUrl,
        competitionId: null,
      }));
  }

  const memberships = await prisma.teamMember.findMany({
    where: { userId, team: { isSuspended: false } },
    include: {
      team: {
        select: {
          id: true,
          name: true,
          logoKey: true,
          logoUrl: true,
          competitionEntries: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: { teamCompetitionId: true },
          },
        },
      },
    },
    orderBy: { joinedAt: "desc" },
  });

  return memberships.map((membership) => ({
    id: membership.team.id,
    name: membership.team.name,
    logoUrl: membership.team.logoKey
      ? teamLogoUrl(membership.team.logoKey)
      : membership.team.logoUrl,
    competitionId: membership.team.competitionEntries[0]?.teamCompetitionId ?? null,
  }));
}

async function getUserTeamName(userId: string): Promise<string | null> {
  const teams = await getUserTeamsForShowcase(userId);
  return teams[0]?.name ?? null;
}

export async function getFullProfile(userId: string) {
  if (await shouldUseMemoryDb()) {
    const user = (await ensureMemoryUser(userId)) ?? devMemoryDb.user.findById(userId);
    const resolvedUserId = user?.id ?? userId;
    const profile = devMemoryDb.profile.getByUserId(resolvedUserId);
    const wallet = devMemoryDb.wallet.getByUserId(resolvedUserId);
    if (!user) return null;
    await ensureDevTestMedalsForUser(resolvedUserId, user.phone);
    const medals = devMemoryDb.medals.listForUser(resolvedUserId);
    const rank = userNeedsDisplayName(user.phone, profile?.displayName)
      ? null
      : await getEligibleGlobalRankForUser(resolvedUserId);
    const honors = buildHonorsList(medals);

    return {
      user: user
        ? { id: user.id, phone: user.phone, username: user.username, role: user.role }
        : null,
      profile: profile
        ? {
            ...profile,
            globalRank: rank,
            perfectPredictions: profile.perfectPredictions,
            cupsEntered: profile.cupsEntered,
            tournamentsEntered: profile.tournamentsEntered,
            teamCompetitionsEntered: profile.teamCompetitionsEntered,
            showcaseSlug: profile.showcaseSlug,
          }
        : null,
      wallet,
      medals,
      honors,
      stats: {
        totalPredictions: profile?.totalPredictions ?? 0,
        perfectPredictions: profile?.perfectPredictions ?? 0,
        cupsEntered: profile?.cupsEntered ?? 0,
        tournamentsEntered: profile?.tournamentsEntered ?? 0,
        teamCompetitionsEntered: profile?.teamCompetitionsEntered ?? 0,
      },
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: { include: { currentLevel: true } },
      wallet: true,
      userMedals: { include: { medal: true }, orderBy: { earnedAt: "desc" } },
    },
  });

  if (!user) return null;

  await ensureDevTestMedalsForUser(userId, user.phone);
  const showcaseSlug = await ensureUserShowcaseSlug(userId);

  const globalRank = userNeedsDisplayName(user.phone, user.profile?.displayName)
    ? null
    : await getEligibleGlobalRankForUser(userId);

  const freshUserMedals = await prisma.userMedal.findMany({
    where: { userId },
    include: { medal: true },
    orderBy: { earnedAt: "desc" },
  });

  const medals = freshUserMedals.map((um) => ({
    ...um,
    medal: um.medal,
  }));
  const honors = buildHonorsList(medals);

  return {
    user: {
      id: user.id,
      phone: user.phone,
      username: user.username,
      role: user.role,
    },
    profile: user.profile
      ? { ...user.profile, globalRank, showcaseSlug: showcaseSlug ?? user.profile.showcaseSlug }
      : null,
    wallet: user.wallet,
    medals,
    honors,
    stats: {
      totalPredictions: user.profile?.totalPredictions ?? 0,
      perfectPredictions: user.profile?.perfectPredictions ?? 0,
      cupsEntered: user.profile?.cupsEntered ?? 0,
      tournamentsEntered: user.profile?.tournamentsEntered ?? 0,
      teamCompetitionsEntered: user.profile?.teamCompetitionsEntered ?? 0,
    },
  };
}

export async function getPublicProfile(slug: string): Promise<PublicProfileData | null> {
  if (await shouldUseMemoryDb()) {
    const profile = devMemoryDb.profile.findBySlug(slug);
    if (!profile) return null;
    const user = devMemoryDb.user.findById(profile.userId);
    if (
      user &&
      isLegacyInvitePlaceholderUser({
        phone: user.phone,
        username: user.username,
        displayName: profile.displayName,
      })
    ) {
      return null;
    }
    const fullProfile = devMemoryDb.profile.getByUserId(profile.userId);
    const level = fullProfile?.currentLevel;
    await ensureDevTestMedalsForUser(profile.userId, user?.phone ?? "");
    const medals = devMemoryDb.medals.listForUser(profile.userId);
    const honors = buildHonorsList(medals);
    const rank =
      user && !userNeedsDisplayName(user.phone, profile.displayName)
        ? await getEligibleGlobalRankForUser(profile.userId)
        : null;
    const teamName = await getUserTeamName(profile.userId);
    const teams = await getUserTeamsForShowcase(profile.userId);

    return {
      showcaseSlug: profile.showcaseSlug ?? slug,
      displayName: profile.displayName ?? user?.username ?? "بازیکن",
      avatarUrl: profile.avatarUrl ?? null,
      level: level?.nameFa ?? null,
      totalXp: profile.totalXp,
      globalRank: rank,
      teamName,
      teams,
      joinedAt: user?.createdAt?.toISOString() ?? new Date().toISOString(),
      medals,
      honors,
      stats: buildPublicProfileStats(
        profile.totalPredictions,
        profile.perfectPredictions,
        profile.cupsEntered,
        profile.tournamentsEntered,
        profile.teamCompetitionsEntered,
      ),
    };
  }

  const profile = await prisma.userProfile.findFirst({
    where: { showcaseSlug: slug },
    include: {
      user: { select: { username: true, phone: true, createdAt: true } },
      currentLevel: true,
    },
  });
  if (!profile) return null;
  if (
    isLegacyInvitePlaceholderUser({
      phone: profile.user.phone,
      username: profile.user.username,
      displayName: profile.displayName,
    })
  ) {
    return null;
  }

  await ensureDevTestMedalsForUser(profile.userId, profile.user.phone);

  const medals = await prisma.userMedal.findMany({
    where: { userId: profile.userId },
    include: { medal: true },
    orderBy: { earnedAt: "desc" },
  });
  const honors = buildHonorsList(medals);

  const globalRank = userNeedsDisplayName(profile.user.phone, profile.displayName)
    ? null
    : await getEligibleGlobalRankForUser(profile.userId);

  const teamName = await getUserTeamName(profile.userId);
  const teams = await getUserTeamsForShowcase(profile.userId);

  return {
    showcaseSlug: profile.showcaseSlug ?? slug,
    displayName: profile.displayName ?? profile.user.username ?? "بازیکن",
    avatarUrl: profile.avatarUrl,
    level: profile.currentLevel?.nameFa ?? null,
    totalXp: profile.totalXp,
    globalRank,
    teamName,
    teams,
    joinedAt: profile.user.createdAt.toISOString(),
    medals,
    honors,
    stats: buildPublicProfileStats(
      profile.totalPredictions,
      profile.perfectPredictions,
      profile.cupsEntered,
      profile.tournamentsEntered,
      profile.teamCompetitionsEntered,
    ),
  };
}

export async function getPublicProfileSlugForUser(userId: string): Promise<string | null> {
  if (await shouldUseMemoryDb()) {
    const profile = devMemoryDb.profile.getByUserId(userId);
    return profile?.showcaseSlug ?? null;
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: { showcaseSlug: true },
  });
  return profile?.showcaseSlug ?? null;
}
