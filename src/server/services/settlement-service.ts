import { CoinTransactionType, CompetitionType, MatchStatus, NotificationCategory, NotificationType } from "@prisma/client";
import { subDays } from "date-fns";
import { prisma } from "@/shared/lib/prisma";
import { serializeKickoffAt } from "@/shared/lib/dates";
import { devMemoryDb } from "@/server/dev-memory-db";
import { shouldUseMemoryDb } from "@/server/db";
import { ensureMemoryUser } from "@/server/ensure-memory-user";
import { calculatePredictionAccuracy } from "@/shared/lib/prediction-accuracy";
import { getRewardFromTable } from "@/shared/constants/reward-tables";
import {
  filterPredictionResultsByTab,
  type PredictionResultFilter,
  type PredictionResultItem,
} from "@/shared/types/prediction-results";
import {
  addSystemRewardCoins,
  addXpWithLevelUp,
  adjustSystemRewardCoins,
} from "@/server/services/wallet-service";
import { createNotification } from "@/server/services/notification-service";
import { isMatchResultKnown } from "@/shared/lib/match-result";
import { logPredictionCategoryChange } from "@/server/services/match-lifecycle-logger";
import { derivePredictionCategory } from "@/shared/lib/match-lifecycle";

async function ensureMatchFinishedForSettlement(matchId: string) {
  if (await shouldUseMemoryDb()) {
    const match = devMemoryDb.kandakator.findMatchById(matchId);
    if (!match) return null;
    const hasScores = match.homeScore !== null && match.awayScore !== null;
    if (!hasScores) return null;
    if (match.status !== "FINISHED") match.status = "FINISHED";
    return match;
  }

  const match = await prisma.footballMatch.findUnique({ where: { id: matchId } });
  if (!match) return null;

  const hasScores = match.homeScore !== null && match.awayScore !== null;
  if (!hasScores) return null;
  if (match.status === "CANCELLED" || match.status === "POSTPONED") return null;

  if (match.status !== "FINISHED") {
    return prisma.footballMatch.update({
      where: { id: matchId },
      data: { status: "FINISHED" },
    });
  }
  return match;
}

function rewardTableForType(competitionType: string): string {
  switch (competitionType) {
    case CompetitionType.CUP:
      return "cup-normal";
    case CompetitionType.TOURNAMENT:
      return "tournament-fath";
    default:
      return "daily-prediction";
  }
}

async function resolveCupRewardSlug(cupId: string): Promise<string> {
  const cup = await prisma.cup.findUnique({ where: { id: cupId } });
  if (!cup) return "cup-normal";
  return cup.mode === "LEGEND" ? "cup-legend" : "cup-normal";
}

/** Persist official scores and settle all predictions for the match. */
export async function applyOfficialMatchResult(
  matchId: string,
  homeScore: number,
  awayScore: number,
  status: MatchStatus = MatchStatus.FINISHED,
) {
  if (await shouldUseMemoryDb()) {
    const match = devMemoryDb.kandakator.findMatchById(matchId);
    if (!match) return { settled: 0 };
    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.status = status;
    return settleMemoryMatchPredictions(matchId);
  }

  await prisma.footballMatch.update({
    where: { id: matchId },
    data: { homeScore, awayScore, status },
  });
  return settleMatchPredictions(matchId);
}

export async function settleMatchPredictions(matchId: string) {
  if (await shouldUseMemoryDb()) {
    return settleMemoryMatchPredictions(matchId);
  }

  const match = await ensureMatchFinishedForSettlement(matchId);
  if (!match) return { settled: 0 };

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
    include: { match: true },
  });

  let settled = 0;
  for (const prediction of predictions) {
    const previousCategory = derivePredictionCategory(prediction, prediction.match);
    const slug =
      prediction.competitionType === CompetitionType.CUP && prediction.competitionRefId
        ? await resolveCupRewardSlug(prediction.competitionRefId)
        : rewardTableForType(prediction.competitionType);

    const rescored = await scoreOrRescorePredictionRecord({
      predictionId: prediction.id,
      userId: prediction.userId,
      homePrediction: prediction.homePrediction,
      awayPrediction: prediction.awayPrediction,
      actualHome: match.homeScore!,
      actualAway: match.awayScore!,
      rewardTableSlug: slug,
      previousAccuracy: prediction.accuracyPercent,
      previousCoins: prediction.coinsEarned,
      previousXp: prediction.xpEarned,
      alreadyScored: prediction.scoredAt !== null,
    });

    if (!rescored) continue;

    if (prediction.scoredAt === null) {
      void logPredictionCategoryChange({
        predictionId: prediction.id,
        userId: prediction.userId,
        previousCategory,
        newCategory: "scored",
        matchId,
        source: "settlement",
      });
    }
    settled += 1;
  }

  void import("@/server/services/team-competition-engine").then(({ onMatchSettledForTeamCompetitions }) =>
    onMatchSettledForTeamCompetitions(matchId),
  );

  return { settled };
}

export async function settleKandakatorFinishedMatches(kandakatorId: string) {
  if (await shouldUseMemoryDb()) {
    const k = devMemoryDb.kandakator.getById(kandakatorId);
    if (!k) return { settled: 0 };
    let settled = 0;
    for (const km of k.matches) {
      if (isMatchResultKnown(km.match)) {
        const result = await settleMemoryMatchPredictions(km.matchId);
        settled += result.settled;
      }
    }
    return { settled };
  }

  const rows = await prisma.kandakatorMatch.findMany({
    where: { kandakatorId },
    include: { match: true },
  });

  let settled = 0;
  for (const row of rows) {
    if (isMatchResultKnown(row.match)) {
      const result = await settleMatchPredictions(row.matchId);
      settled += result.settled;
    }
  }
  return { settled };
}

export async function settleMemoryMatchPredictions(matchId: string) {
  const match = devMemoryDb.kandakator.findMatchById(matchId);
  if (!match || !isMatchResultKnown(match)) {
    return { settled: 0 };
  }
  if (match.status !== "FINISHED") match.status = "FINISHED";

  const predictions = devMemoryDb.predictions.listForMatch(matchId);
  let settled = 0;

  for (const prediction of predictions) {
    let slug = "daily-prediction";
    if (prediction.competitionType === "CUP" && prediction.competitionRefId) {
      const cup = devMemoryDb.competitions.getCup(
        prediction.competitionRefId,
        prediction.userId,
      );
      slug = (cup?.rewardTableSlug as string) ?? "cup-normal";
    } else if (prediction.competitionType === "TOURNAMENT") {
      slug = "tournament-fath";
    }

    const accuracy = calculatePredictionAccuracy(
      prediction.homePrediction,
      prediction.awayPrediction,
      match.homeScore!,
      match.awayScore!,
    );

    if (prediction.scoredAt !== null) {
      if (prediction.accuracyPercent === accuracy) continue;
      const reward = getRewardFromTable(slug, accuracy);
      const oldCoins = prediction.coinsEarned ?? 0;
      const oldXp = prediction.xpEarned ?? 0;
      prediction.accuracyPercent = accuracy;
      prediction.coinsEarned = reward.coins;
      prediction.xpEarned = reward.xp;
      const coinDelta = reward.coins - oldCoins;
      const xpDelta = reward.xp - oldXp;
      if (coinDelta !== 0) devMemoryDb.wallet.adjustSystemReward(prediction.userId, coinDelta);
      if (xpDelta !== 0) devMemoryDb.profile.addXp(prediction.userId, xpDelta);
      settled += 1;
      continue;
    }

    devMemoryDb.predictions.score({
      predictionId: prediction.id,
      userId: prediction.userId,
      homePrediction: prediction.homePrediction,
      awayPrediction: prediction.awayPrediction,
      actualHome: match.homeScore!,
      actualAway: match.awayScore!,
      rewardTableSlug: slug,
    });
    await notifyPredictionSettled(prediction.userId);
    settled += 1;
  }

  return { settled };
}

async function awardMedalForPrediction(
  userId: string,
  medalSlug: string | undefined,
  predictionId: string,
) {
  if (!medalSlug) return null;
  if (await shouldUseMemoryDb()) {
    devMemoryDb.medals.award(userId, medalSlug, "پاداش پیش‌بینی");
    const medal = devMemoryDb.medals
      .listForUser(userId)
      .map((m) => m.medal)
      .find((m) => m?.slug === medalSlug);
    return medal ? { id: medal.id, titleFa: medal.titleFa, tier: medal.tier } : null;
  }

  const medal = await prisma.medal.findUnique({ where: { slug: medalSlug } });
  if (!medal) return null;

  try {
    await prisma.userMedal.create({
      data: {
        userId,
        medalId: medal.id,
        earnedReason: "پاداش پیش‌بینی",
        referenceId: predictionId,
      },
    });
    const { publishMedalEarnedSystemMessage } = await import(
      "@/server/services/chat-system-events"
    );
    void publishMedalEarnedSystemMessage(userId, medal.titleFa);
  } catch {
    // duplicate medal for same reference
    return null;
  }

  await prisma.prediction.update({
    where: { id: predictionId },
    data: { medalId: medal.id },
  });

  return { id: medal.id, titleFa: medal.titleFa, tier: medal.tier };
}

async function notifyPredictionSettled(userId: string) {
  await createNotification({
    userId,
    type: NotificationType.PREDICTION_SETTLED,
    category: NotificationCategory.MESSAGE,
    titleFa: "نتیجه پیش‌بینی",
    bodyFa: "نتیجه بازی که پیش‌بینی کردی مشخص شده!",
    link: null,
    secondaryLink: "/profile/predictions?filter=settled",
    secondaryLinkLabelFa: "نشونم بده",
  });
}

async function scoreOrRescorePredictionRecord(input: {
  predictionId: string;
  userId: string;
  homePrediction: number;
  awayPrediction: number;
  actualHome: number;
  actualAway: number;
  rewardTableSlug: string;
  previousAccuracy?: number | null;
  previousCoins?: number | null;
  previousXp?: number | null;
  alreadyScored?: boolean;
}): Promise<boolean> {
  const accuracy = calculatePredictionAccuracy(
    input.homePrediction,
    input.awayPrediction,
    input.actualHome,
    input.actualAway,
  );
  const reward = getRewardFromTable(input.rewardTableSlug, accuracy);

  if (input.alreadyScored) {
    if (input.previousAccuracy === accuracy) return false;

    const oldCoins = input.previousCoins ?? 0;
    const oldXp = input.previousXp ?? 0;
    const coinDelta = reward.coins - oldCoins;
    const xpDelta = reward.xp - oldXp;

    await prisma.$transaction(async (tx) => {
      await tx.prediction.update({
        where: { id: input.predictionId },
        data: {
          accuracyPercent: accuracy,
          coinsEarned: reward.coins,
          xpEarned: reward.xp,
        },
      });

      const wasPerfect = input.previousAccuracy === 100;
      const isPerfect = accuracy === 100;
      if (!wasPerfect && isPerfect) {
        await tx.userProfile.update({
          where: { userId: input.userId },
          data: { perfectPredictions: { increment: 1 } },
        });
      } else if (wasPerfect && !isPerfect) {
        await tx.userProfile.update({
          where: { userId: input.userId },
          data: { perfectPredictions: { decrement: 1 } },
        });
      }
    });

    if (coinDelta !== 0) {
      await adjustSystemRewardCoins(
        input.userId,
        coinDelta,
        `اصلاح سکه جایزه سیستمی — ${accuracy}٪ دقت`,
      );
    }

    if (xpDelta !== 0) {
      await addXpWithLevelUp(
        input.userId,
        xpDelta,
        "PREDICTION",
        "اصلاح امتیاز پیش‌بینی",
      );
    }

    if (accuracy === 100 && input.previousAccuracy !== 100) {
      const { publishPerfectPredictionSystemMessage } = await import(
        "@/server/services/chat-system-events"
      );
      void publishPerfectPredictionSystemMessage(input.userId);
    }

    return true;
  }

  await prisma.$transaction(async (tx) => {
    await tx.prediction.update({
      where: { id: input.predictionId },
      data: {
        accuracyPercent: accuracy,
        coinsEarned: reward.coins,
        xpEarned: reward.xp,
        scoredAt: new Date(),
      },
    });

    if (accuracy === 100) {
      await tx.userProfile.update({
        where: { userId: input.userId },
        data: { perfectPredictions: { increment: 1 } },
      });
    }
  });

  if (accuracy === 100) {
    const { publishPerfectPredictionSystemMessage } = await import(
      "@/server/services/chat-system-events"
    );
    void publishPerfectPredictionSystemMessage(input.userId);
  }

  if (reward.coins > 0) {
    await addSystemRewardCoins(
      input.userId,
      reward.coins,
      CoinTransactionType.PREDICTION_REWARD,
      `سکه جایزه سیستمی — ${accuracy}٪ دقت`,
    );
  }

  if (reward.xp > 0) {
    await addXpWithLevelUp(input.userId, reward.xp, "PREDICTION", "امتیاز پیش‌بینی");
  }

  await awardMedalForPrediction(input.userId, reward.medalSlug, input.predictionId);
  await notifyPredictionSettled(input.userId);
  return true;
}

/**
 * Read-only DB scan + background signals for profile prediction reads.
 * Never performs settlement writes on the request path (production).
 */
async function signalBackgroundWorkForRecentPredictions(userId: string) {
  const since = subDays(new Date(), 7);
  const { tehranDateKey } = await import("@/server/memory/kandakator-seed");

  if (await shouldUseMemoryDb()) {
    const uid = (await ensureMemoryUser(userId))?.id ?? userId;
    let unscored = devMemoryDb.predictions.listUnscoredForUserSince(uid, since);
    const dateKeysToSync = new Set<string>();
    const now = Date.now();

    for (const prediction of unscored) {
      const match = devMemoryDb.kandakator.findMatchById(prediction.matchId);
      if (match && match.kickoffAt.getTime() <= now && !isMatchResultKnown(match)) {
        dateKeysToSync.add(tehranDateKey(match.kickoffAt));
      }
    }

    if (dateKeysToSync.size > 0) {
      const { refreshKandakatorScoresForDates } = await import(
        "@/server/services/kandakator-service"
      );
      await refreshKandakatorScoresForDates([...dateKeysToSync]);
      unscored = devMemoryDb.predictions.listUnscoredForUserSince(uid, since);
    }

    for (const prediction of unscored) {
      await settleMemoryMatchPredictions(prediction.matchId);
    }

    return;
  }

  const unscored = await prisma.prediction.findMany({
    where: { userId, submittedAt: { gte: since }, scoredAt: null },
    include: { match: true },
  });

  const dateKeysToSync = new Set<string>();
  const matchIdsToSettle = new Set<string>();
  const now = Date.now();

  for (const prediction of unscored) {
    if (isMatchResultKnown(prediction.match)) {
      matchIdsToSettle.add(prediction.matchId);
    } else if (prediction.match.kickoffAt.getTime() <= now) {
      dateKeysToSync.add(tehranDateKey(prediction.match.kickoffAt));
    }
  }

  if (dateKeysToSync.size > 0) {
    const { signalBackgroundSyncForKandakatorDates } = await import(
      "@/server/services/kandakator-remote-sync-service"
    );
    void signalBackgroundSyncForKandakatorDates([...dateKeysToSync], "prediction-read").catch(
      () => {},
    );
  }

  if (matchIdsToSettle.size > 0) {
    const { scheduleMatchPredictionsSettlement } = await import(
      "@/server/services/settlement-scheduler"
    );
    scheduleMatchPredictionsSettlement([...matchIdsToSettle]);
  }
}

export async function getUserPredictionResultsLast7Days(
  userId: string,
  filter: PredictionResultFilter,
): Promise<PredictionResultItem[]> {
  const uid = (await shouldUseMemoryDb())
    ? ((await ensureMemoryUser(userId))?.id ?? userId)
    : userId;
  const since = subDays(new Date(), 7);

  await signalBackgroundWorkForRecentPredictions(uid);

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.predictions.listResultsLast7Days(uid, filter, since);
  }

  const rows = await prisma.prediction.findMany({
    where: { userId: uid, submittedAt: { gte: since } },
    orderBy: { submittedAt: "desc" },
    include: { match: true },
  });

  const medalIds = rows.map((r) => r.medalId).filter((id): id is string => !!id);
  const medals =
    medalIds.length > 0
      ? await prisma.medal.findMany({ where: { id: { in: medalIds } } })
      : [];
  const medalMap = new Map(medals.map((m) => [m.id, m]));

  const results = rows
    .map((row) => {
      const hasScore = isMatchResultKnown(row.match);
      const accuracyPercent =
        row.scoredAt !== null
          ? row.accuracyPercent
          : hasScore
            ? calculatePredictionAccuracy(
                row.homePrediction,
                row.awayPrediction,
                row.match.homeScore!,
                row.match.awayScore!,
              )
            : null;

      return {
        id: row.id,
        homePrediction: row.homePrediction,
        awayPrediction: row.awayPrediction,
        entryFeeCoins: row.entryFeeCoins,
        accuracyPercent,
        coinsEarned: row.coinsEarned,
        xpEarned: row.xpEarned,
        scoredAt: row.scoredAt?.toISOString() ?? null,
        submittedAt: row.submittedAt.toISOString(),
        competitionType: row.competitionType,
        competitionRefId: row.competitionRefId,
        medal: row.medalId
          ? {
              id: row.medalId,
              titleFa: medalMap.get(row.medalId)?.titleFa ?? "",
              tier: medalMap.get(row.medalId)?.tier ?? "",
            }
          : null,
        match: {
          id: row.match.id,
          homeTeamName: row.match.homeTeamName,
          awayTeamName: row.match.awayTeamName,
          leagueName: row.match.leagueName,
          kickoffAt: serializeKickoffAt(row.match.kickoffAt),
          homeScore: row.match.homeScore,
          awayScore: row.match.awayScore,
          status: row.match.status,
        },
      };
    });

  return filterPredictionResultsByTab(results, filter);
}

export async function getUserPredictionResults(userId: string, limit = 30) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.predictions.listResultsForUser(userId, limit);
  }

  const rows = await prisma.prediction.findMany({
    where: { userId },
    orderBy: { submittedAt: "desc" },
    take: limit,
    include: {
      match: {
        select: {
          id: true,
          homeTeamName: true,
          awayTeamName: true,
          leagueName: true,
          kickoffAt: true,
          homeScore: true,
          awayScore: true,
          status: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    homePrediction: row.homePrediction,
    awayPrediction: row.awayPrediction,
    entryFeeCoins: row.entryFeeCoins,
    accuracyPercent: row.accuracyPercent,
    coinsEarned: row.coinsEarned,
    xpEarned: row.xpEarned,
    scoredAt: row.scoredAt?.toISOString() ?? null,
    submittedAt: row.submittedAt.toISOString(),
    competitionType: row.competitionType,
    match: {
      id: row.match.id,
      homeTeamName: row.match.homeTeamName,
      awayTeamName: row.match.awayTeamName,
      leagueName: row.match.leagueName,
      kickoffAt: serializeKickoffAt(row.match.kickoffAt),
      homeScore: row.match.homeScore,
      awayScore: row.match.awayScore,
      status: row.match.status,
    },
  }));
}

export async function rescoreAllFinishedMatchPredictions() {
  if (await shouldUseMemoryDb()) {
    let rescored = 0;
    for (const k of devMemoryDb.kandakator.listAll()) {
      for (const km of k.matches) {
        if (isMatchResultKnown(km.match)) {
          const result = await settleMemoryMatchPredictions(km.matchId);
          rescored += result.settled;
        }
      }
    }
    return { rescored };
  }

  const matches = await prisma.footballMatch.findMany({
    where: {
      homeScore: { not: null },
      awayScore: { not: null },
      status: { notIn: ["CANCELLED", "POSTPONED"] },
    },
    select: { id: true },
  });

  let rescored = 0;
  for (const match of matches) {
    const result = await settleMatchPredictions(match.id);
    rescored += result.settled;
  }
  return { rescored };
}

export async function settleAllFinishedMatches() {
  if (await shouldUseMemoryDb()) {
    let settled = 0;
    for (const k of devMemoryDb.kandakator.listAll()) {
      for (const km of k.matches) {
        if (isMatchResultKnown(km.match)) {
          const result = await settleMemoryMatchPredictions(km.matchId);
          settled += result.settled;
        }
      }
    }
    return { settled };
  }

  const matches = await prisma.footballMatch.findMany({
    where: {
      homeScore: { not: null },
      awayScore: { not: null },
    },
    select: { id: true },
  });

  let settled = 0;
  for (const match of matches) {
    const result = await settleMatchPredictions(match.id);
    settled += result.settled;
  }
  return { settled };
}
