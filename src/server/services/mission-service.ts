import { XpTransactionType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import {
  MISSION_DEFINITIONS,
  enrichMissionTier,
  getMissionDefinition,
  type MissionDefinition,
  type MissionTierDefinition,
} from "@/shared/constants/missions";
import type {
  MissionCardStatus,
  MissionCardView,
  MissionClaimResult,
  MissionTierView,
} from "@/shared/types/missions";
import { countSuccessfulInvites } from "@/server/services/invite-service";
import { adjustFootballCredits, addXpWithLevelUp } from "@/server/services/wallet-service";

type ProgressSnapshot = {
  inviteCount: number;
  totalPredictions: number;
  perfectPredictions: number;
};

type ClaimRecord = {
  missionSlug: string;
  tierKey: string;
  claimedAt: Date;
};

async function loadProgressSnapshot(userId: string): Promise<ProgressSnapshot> {
  if (await shouldUseMemoryDb()) {
    const profile = devMemoryDb.profile.getByUserId(userId);
    return {
      inviteCount: devMemoryDb.invites.countForUser(userId),
      totalPredictions: profile?.totalPredictions ?? 0,
      perfectPredictions: profile?.perfectPredictions ?? 0,
    };
  }

  const [profile, inviteCount] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: { totalPredictions: true, perfectPredictions: true },
    }),
    countSuccessfulInvites(userId),
  ]);

  return {
    inviteCount,
    totalPredictions: profile?.totalPredictions ?? 0,
    perfectPredictions: profile?.perfectPredictions ?? 0,
  };
}

async function loadClaims(userId: string): Promise<ClaimRecord[]> {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.missionClaims.listForUser(userId);
  }

  const rows = await prisma.missionTierClaim.findMany({
    where: { userId },
    select: { missionSlug: true, tierKey: true, claimedAt: true },
  });
  return rows;
}

function readProgressValue(source: MissionDefinition["progressSource"], snapshot: ProgressSnapshot) {
  if (source === "invite_count") return Math.min(snapshot.inviteCount, 10);
  if (source === "total_predictions") return snapshot.totalPredictions;
  return snapshot.perfectPredictions;
}

function isMissionFullyClaimed(mission: MissionDefinition, claimedTierKeys: Set<string>) {
  return mission.tiers.every((tier) => claimedTierKeys.has(tier.tierKey));
}

function isPrerequisiteMet(
  mission: MissionDefinition,
  claimsByMission: Map<string, Set<string>>,
) {
  if (!mission.prerequisiteMissionSlug) return true;
  const prereq = getMissionDefinition(mission.prerequisiteMissionSlug);
  if (!prereq) return true;
  const claimed = claimsByMission.get(prereq.slug) ?? new Set<string>();
  return isMissionFullyClaimed(prereq, claimed);
}

function findNextUnclaimedTier(mission: MissionDefinition, claimedTierKeys: Set<string>) {
  return mission.tiers.find((tier) => !claimedTierKeys.has(tier.tierKey)) ?? null;
}

function findClaimableTier(mission: MissionDefinition, progress: number, claimedTierKeys: Set<string>) {
  return (
    mission.tiers.find(
      (tier) => !claimedTierKeys.has(tier.tierKey) && progress >= tier.threshold,
    ) ?? null
  );
}

function resolveTierRewardAmounts(
  mission: MissionDefinition,
  tier: MissionTierDefinition,
  progress: number,
) {
  if (mission.slug === "davat") {
    const inviteCount = Math.min(progress, tier.threshold);
    return {
      coins: inviteCount * tier.coins,
      xp: inviteCount * tier.xp,
    };
  }
  return { coins: tier.coins, xp: tier.xp };
}

function buildTierViews(
  mission: MissionDefinition,
  progress: number,
  claimedTierKeys: Set<string>,
): MissionTierView[] {
  return mission.tiers.map((tier) => {
    const enriched = enrichMissionTier(tier);
    const claimed = claimedTierKeys.has(tier.tierKey);
    const rewards = resolveTierRewardAmounts(mission, tier, progress);
    return {
      tierKey: tier.tierKey,
      tierLabelFa: tier.tierLabelFa,
      threshold: tier.threshold,
      coins: rewards.coins,
      xp: rewards.xp,
      medalSlug: tier.medalSlug,
      medalTitleFa: enriched.medalTitleFa,
      claimed,
      claimable: !claimed && progress >= tier.threshold,
    };
  });
}

function computeMissionStatus(
  mission: MissionDefinition,
  progress: number,
  claimedTierKeys: Set<string>,
  prerequisiteMet: boolean,
): MissionCardStatus {
  if (!prerequisiteMet) return "LOCKED";
  if (isMissionFullyClaimed(mission, claimedTierKeys)) return "COMPLETED";
  if (findClaimableTier(mission, progress, claimedTierKeys)) return "READY_TO_CLAIM";
  return "IN_PROGRESS";
}

function buildMissionCard(
  mission: MissionDefinition,
  snapshot: ProgressSnapshot,
  claimsByMission: Map<string, Set<string>>,
): MissionCardView {
  const claimedTierKeys = claimsByMission.get(mission.slug) ?? new Set<string>();
  const prerequisiteMet = isPrerequisiteMet(mission, claimsByMission);
  const progress = readProgressValue(mission.progressSource, snapshot);
  const nextTier = findNextUnclaimedTier(mission, claimedTierKeys);
  const finalTier = mission.tiers[mission.tiers.length - 1];
  const progressTarget = nextTier?.threshold ?? finalTier.threshold;
  const progressPercent = progressTarget > 0 ? Math.min(100, (progress / progressTarget) * 100) : 100;
  const claimableTier = findClaimableTier(mission, progress, claimedTierKeys);

  return {
    slug: mission.slug,
    titleFa: mission.titleFa,
    descriptionFa: mission.descriptionFa,
    tooltipFa: mission.tooltipFa,
    status: computeMissionStatus(mission, progress, claimedTierKeys, prerequisiteMet),
    autoClaimOnComplete: mission.autoClaimOnComplete,
    currentProgress: progress,
    progressTarget,
    progressPercent,
    claimedTierKeys: [...claimedTierKeys],
    claimableTierKey: claimableTier?.tierKey ?? null,
    tiers: buildTierViews(mission, progress, claimedTierKeys),
  };
}

async function grantMissionMedal(userId: string, medalSlug: string, reason: string) {
  if (await shouldUseMemoryDb()) {
    devMemoryDb.medals.award(userId, medalSlug, reason);
    const medal = devMemoryDb.medals
      .listForUser(userId)
      .map((row) => row.medal)
      .find((row) => row?.slug === medalSlug);
    return medal ? { slug: medalSlug, titleFa: medal.titleFa } : null;
  }

  const medal = await prisma.medal.findUnique({ where: { slug: medalSlug } });
  if (!medal) return null;

  try {
    await prisma.userMedal.create({
      data: {
        userId,
        medalId: medal.id,
        earnedReason: reason,
      },
    });
    const { publishMedalEarnedSystemMessage } = await import(
      "@/server/services/chat-system-events"
    );
    void publishMedalEarnedSystemMessage(userId, medal.titleFa);
    return { slug: medalSlug, titleFa: medal.titleFa };
  } catch {
    return { slug: medalSlug, titleFa: medal.titleFa };
  }
}

async function recordClaim(userId: string, missionSlug: string, tierKey: string) {
  if (await shouldUseMemoryDb()) {
    devMemoryDb.missionClaims.record(userId, missionSlug, tierKey);
    return;
  }

  await prisma.missionTierClaim.create({
    data: { userId, missionSlug, tierKey },
  });
}

async function hasClaim(userId: string, missionSlug: string, tierKey: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.missionClaims.hasClaim(userId, missionSlug, tierKey);
  }

  const row = await prisma.missionTierClaim.findUnique({
    where: {
      userId_missionSlug_tierKey: { userId, missionSlug, tierKey },
    },
  });
  return Boolean(row);
}

async function distributeTierRewards(
  userId: string,
  mission: MissionDefinition,
  tier: MissionTierDefinition,
): Promise<MissionClaimResult> {
  const enriched = enrichMissionTier(tier);
  const description = `پاداش ماموریت ${mission.titleFa} — ${tier.tierLabelFa}`;

  // Per-invite rewards for "davat" are granted at signup via invite-service.
  // Mission medal rewards now grant Football Credit instead of coins.
  const creditToGrant = mission.slug === "davat" ? 0 : tier.coins;
  const xpToGrant = mission.slug === "davat" ? 0 : tier.xp;

  if (creditToGrant > 0) {
    await adjustFootballCredits(userId, creditToGrant);
  }

  if (xpToGrant > 0) {
    await addXpWithLevelUp(userId, xpToGrant, XpTransactionType.MISSION, description);
  }

  if (tier.medalSlug) {
    await grantMissionMedal(userId, tier.medalSlug, description);
  }

  return {
    missionSlug: mission.slug,
    tierKey: tier.tierKey,
    coins: creditToGrant,
    xp: xpToGrant,
    medalSlug: tier.medalSlug,
    medalTitleFa: enriched.medalTitleFa,
    missionTitleFa: mission.titleFa,
  };
}

const MISSION_STATUS_SORT: Record<MissionCardStatus, number> = {
  READY_TO_CLAIM: 0,
  IN_PROGRESS: 1,
  LOCKED: 2,
  COMPLETED: 3,
};

export async function getMissionsForUser(userId: string): Promise<MissionCardView[]> {
  await tryAutoCompleteInviteMission(userId);

  const [snapshot, claims] = await Promise.all([
    loadProgressSnapshot(userId),
    loadClaims(userId),
  ]);

  const claimsByMission = new Map<string, Set<string>>();
  for (const claim of claims) {
    const set = claimsByMission.get(claim.missionSlug) ?? new Set<string>();
    set.add(claim.tierKey);
    claimsByMission.set(claim.missionSlug, set);
  }

  return [...MISSION_DEFINITIONS]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((mission) => buildMissionCard(mission, snapshot, claimsByMission))
    .sort((a, b) => {
      const statusDiff = MISSION_STATUS_SORT[a.status] - MISSION_STATUS_SORT[b.status];
      if (statusDiff !== 0) return statusDiff;
      return a.slug.localeCompare(b.slug, "fa");
    });
}

export async function claimMissionTierReward(
  userId: string,
  missionSlug: string,
  tierKey?: string,
): Promise<MissionClaimResult> {
  const mission = getMissionDefinition(missionSlug);
  if (!mission) throw new Error("ماموریت یافت نشد");
  if (mission.autoClaimOnComplete) {
    throw new Error("این ماموریت به‌صورت خودکار تکمیل می‌شود");
  }

  const snapshot = await loadProgressSnapshot(userId);
  const progress = readProgressValue(mission.progressSource, snapshot);
  const claims = await loadClaims(userId);
  const claimedTierKeys = new Set(
    claims.filter((row) => row.missionSlug === missionSlug).map((row) => row.tierKey),
  );

  const claimsByMission = new Map<string, Set<string>>();
  for (const claim of claims) {
    const set = claimsByMission.get(claim.missionSlug) ?? new Set<string>();
    set.add(claim.tierKey);
    claimsByMission.set(claim.missionSlug, set);
  }

  if (!isPrerequisiteMet(mission, claimsByMission)) {
    throw new Error("این ماموریت هنوز باز نشده است");
  }

  const tier =
    (tierKey ? mission.tiers.find((row) => row.tierKey === tierKey) : null) ??
    findClaimableTier(mission, progress, claimedTierKeys);

  if (!tier) throw new Error("پاداشی برای دریافت وجود ندارد");
  if (claimedTierKeys.has(tier.tierKey)) throw new Error("این پاداش قبلاً دریافت شده");
  if (progress < tier.threshold) throw new Error("شرایط ماموریت هنوز محقق نشده");

  const result = await distributeTierRewards(userId, mission, tier);
  await recordClaim(userId, mission.slug, tier.tierKey);
  return result;
}

/** Auto-grants invite mission reward when 10 successful referrals are reached. */
export async function tryAutoCompleteInviteMission(userId: string): Promise<MissionClaimResult | null> {
  const mission = getMissionDefinition("davat");
  if (!mission) return null;

  const tier = mission.tiers[0];
  if (await hasClaim(userId, mission.slug, tier.tierKey)) return null;

  const snapshot = await loadProgressSnapshot(userId);
  if (snapshot.inviteCount < tier.threshold) return null;

  const result = await distributeTierRewards(userId, mission, tier);
  await recordClaim(userId, mission.slug, tier.tierKey);
  return result;
}
