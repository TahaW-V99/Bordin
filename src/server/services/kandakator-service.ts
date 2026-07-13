import { addDays } from "date-fns";
import { prisma } from "@/shared/lib/prisma";
import { devMemoryDb } from "@/server/dev-memory-db";
import { shouldUseMemoryDb } from "@/server/db";
import { REWARD_TABLES } from "@/shared/constants/reward-tables";
import { isMatchResultKnown } from "@/shared/lib/match-result";
import {
  formatWeekDayLabel,
  formatWeekDayShort,
  getTehranWeekStart,
  tehranDateKey,
} from "@/server/memory/kandakator-seed";
import { kandakatorDateFromKey, serializeKickoffAt } from "@/shared/lib/dates";
import { userNeedsDisplayName as checkDisplayName } from "@/shared/lib/kandakator-utils";
import {
  awaitKandakatorScoreRefresh,
  prepareKandakatorForDisplay,
} from "@/server/services/kandakator-sync-service";
import { resolveDailyPredictionEntryFeesForMatches } from "@/server/services/team-competition-prediction-fee-service";
import {
  resolveTeamCompetitionBadgesForMatches,
  type TeamCompetitionKandakatorBadge,
} from "@/server/services/team-competition-kandakator-badge-service";
import {
  settleKandakatorFinishedMatches,
  settleMatchPredictions,
} from "@/server/services/settlement-service";
import {
  fetchMatchesForTehranDate,
  isFootballDataConfigured,
  mapFootballDataStatus,
  readMatchScore,
} from "@/server/services/football-data-api";
import { translateMatchTeamsToFa } from "@/shared/lib/football-names-fa";
import { getKnockoutPredictionUiState } from "@/server/services/team-competition-knockout-prediction-service";

export type KnockoutPredictionUiState = {
  role: "captain" | "member";
  message: string | null;
  canSubmit: boolean;
};

export type KandakatorMatchDto = {
  id: string;
  matchId: string;
  sortOrder: number;
  predictionCutoffMinutes: number;
  entryFeeCoins: number;
  teamCompetitionBadges?: TeamCompetitionKandakatorBadge[];
  knockoutUiState?: KnockoutPredictionUiState | null;
  match: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    leagueName: string | null;
    kickoffAt: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  };
  prediction: {
    homePrediction: number;
    awayPrediction: number;
    accuracyPercent: number | null;
    coinsEarned: number | null;
    xpEarned: number | null;
  } | null;
};

export type KandakatorDto = {
  id: string;
  title: string | null;
  date: string;
  entryFeeCoins: number;
  perfectReward: { coins: number; xp: number };
  matches: KandakatorMatchDto[];
};

export function getDailyPerfectReward() {
  const tier = REWARD_TABLES["daily-prediction"].find((t) => t.accuracyPercent === 100);
  return { coins: tier?.coins ?? 1200, xp: tier?.xp ?? 900 };
}

export function userNeedsDisplayName(phone: string, displayName: string | null | undefined) {
  return checkDisplayName(phone, displayName);
}

export function getTehranWeekDays() {
  const weekStart = getTehranWeekStart();
  const todayKey = tehranDateKey(new Date());

  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dateKey = tehranDateKey(date);
    return {
      date: dateKey,
      label: formatWeekDayLabel(date),
      shortLabel: formatWeekDayShort(date),
      isToday: dateKey === todayKey,
    };
  });
}

export function groupMatchesByLeague(matches: KandakatorMatchDto[]) {
  const groups = new Map<string, KandakatorMatchDto[]>();
  for (const item of matches) {
    const league = item.match.leagueName?.trim() || "سایر مسابقات";
    const list = groups.get(league) ?? [];
    list.push(item);
    groups.set(league, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, "fa"))
    .map(([leagueName, leagueMatches]) => ({
      leagueName,
      matches: leagueMatches.sort((a, b) => a.sortOrder - b.sortOrder),
    }));
}

function serializeMemoryKandakator(
  userId: string,
  kandakator: NonNullable<ReturnType<typeof devMemoryDb.kandakator.getByDate>>,
  dateKey: string,
): KandakatorDto {
  const dayMatches = filterMatchesForTehranDate(kandakator.matches, dateKey);
  const matchIds = dayMatches.map((km) => km.matchId);
  const userPredictions = devMemoryDb.predictions.listForDailyMatchIds(userId, matchIds);
  const predictionMap = new Map(userPredictions.map((p) => [p.matchId, p]));
  const defaultFee = kandakator.entryFeeCoins;

  return {
    id: kandakator.id,
    title: kandakator.title,
    date: kandakator.date.toISOString(),
    entryFeeCoins: defaultFee,
    perfectReward: getDailyPerfectReward(),
    matches: dayMatches.map((km) => ({
      id: km.id,
      matchId: km.matchId,
      sortOrder: km.sortOrder,
      predictionCutoffMinutes: km.predictionCutoffMinutes,
      entryFeeCoins: defaultFee,
      match: translateMatchTeamsToFa({
        ...km.match,
        kickoffAt: serializeKickoffAt(km.match.kickoffAt),
      }),
      prediction: predictionMap.get(km.matchId) ?? null,
    })),
  };
}

async function hydrateMemoryKandakatorFromApi(dateKey: string, options?: { noCache?: boolean }) {
  const apiMatches = await fetchMatchesForTehranDate(dateKey, {
    noCache: options?.noCache ?? false,
  });
  if (apiMatches.length === 0) return false;

  const sorted = [...apiMatches].sort(
    (a, b) => new Date(a.utcDate).getTime() - new Date(b.utcDate).getTime(),
  );

  const apiItems = sorted.map((match) => {
    const matchId = `football-data-${match.id}`;
    const { homeScore, awayScore } = readMatchScore(match);
    const existing = devMemoryDb.kandakator.findMatchById(matchId);
    return translateMatchTeamsToFa({
      matchId,
      homeTeamName: match.homeTeam.name,
      awayTeamName: match.awayTeam.name,
      leagueName: match.competition?.name ?? null,
      kickoffAt: new Date(match.utcDate),
      homeScore: homeScore ?? existing?.homeScore ?? null,
      awayScore: awayScore ?? existing?.awayScore ?? null,
      status: mapFootballDataStatus(match.status),
    });
  });

  devMemoryDb.kandakator.mergeDayFromApi(dateKey, apiItems);

  for (const km of devMemoryDb.kandakator.getByDate(dateKey)?.matches ?? []) {
    if (isMatchResultKnown(km.match)) {
      await settleMatchPredictions(km.matchId);
    }
  }

  return true;
}

/** One-shot score sync for the given Tehran date keys (no polling). */
export async function refreshKandakatorScoresForDates(dateKeys: string[]) {
  const unique = [...new Set(dateKeys.filter(Boolean))];
  if (unique.length === 0) return;

  if (await shouldUseMemoryDb()) {
    if (!isFootballDataConfigured()) return;
    for (const dateKey of unique) {
      try {
        await hydrateMemoryKandakatorFromApi(dateKey, { noCache: true });
      } catch {
        // keep seed data if API unavailable
      }
    }
    return;
  }

  const { awaitKandakatorScoreRefresh } = await import(
    "@/server/services/kandakator-sync-service"
  );
  await awaitKandakatorScoreRefresh(unique);
}

function filterMatchesForTehranDate<T extends { match: { kickoffAt: Date } }>(
  rows: T[],
  dateKey: string,
): T[] {
  return rows.filter((row) => tehranDateKey(row.match.kickoffAt) === dateKey);
}

async function loadPublishedKandakatorWithMatches(targetKey: string) {
  const dayStart = kandakatorDateFromKey(targetKey);
  return prisma.dailyKandakator.findFirst({
    where: {
      date: { gte: dayStart, lt: addDays(dayStart, 1) },
      isPublished: true,
    },
    include: {
      matches: {
        orderBy: { sortOrder: "asc" },
        include: { match: true },
      },
    },
  });
}

function scoreRefreshDateKeys(targetKey: string) {
  const todayKey = tehranDateKey(new Date());
  const yesterdayKey = tehranDateKey(addDays(kandakatorDateFromKey(targetKey), -1));
  if (yesterdayKey < todayKey && yesterdayKey !== targetKey) {
    return [targetKey, yesterdayKey];
  }
  return [targetKey];
}

async function buildKandakatorDto(
  userId: string,
  targetKey: string,
  kandakator: NonNullable<Awaited<ReturnType<typeof loadPublishedKandakatorWithMatches>>>,
): Promise<KandakatorDto> {
  const dayMatches = filterMatchesForTehranDate(kandakator.matches, targetKey);
  const matchIds = dayMatches.map((km) => km.matchId);

  const userPredictions = await prisma.prediction.findMany({
    where: {
      userId,
      competitionType: "DAILY",
      matchId: { in: matchIds },
    },
    select: {
      matchId: true,
      homePrediction: true,
      awayPrediction: true,
      accuracyPercent: true,
      coinsEarned: true,
      xpEarned: true,
    },
  });

  const predictionMap = new Map(userPredictions.map((p) => [p.matchId, p]));
  const defaultFee = kandakator.entryFeeCoins;
  const feeByMatchId = await resolveDailyPredictionEntryFeesForMatches(
    userId,
    dayMatches.map((km) => ({
      id: km.match.id,
      kickoffAt: km.match.kickoffAt,
      leagueName: km.match.leagueName,
      externalId: km.match.externalId,
    })),
    defaultFee,
  );
  const badgeByMatchId = await resolveTeamCompetitionBadgesForMatches(
    userId,
    dayMatches.map((km) => ({
      id: km.match.id,
      kickoffAt: km.match.kickoffAt,
      leagueName: km.match.leagueName,
      externalId: km.match.externalId,
    })),
  );

  const knockoutUiByMatchId = new Map<string, KnockoutPredictionUiState | null>();
  await Promise.all(
    dayMatches.map(async (km) => {
      const state = await getKnockoutPredictionUiState(userId, km.matchId, kandakator.id);
      knockoutUiByMatchId.set(km.matchId, state);
    }),
  );

  return {
    id: kandakator.id,
    title: kandakator.title,
    date: kandakator.date.toISOString(),
    entryFeeCoins: defaultFee,
    perfectReward: getDailyPerfectReward(),
    matches: dayMatches.map((km) => ({
      id: km.id,
      matchId: km.matchId,
      sortOrder: km.sortOrder,
      predictionCutoffMinutes: km.predictionCutoffMinutes,
      entryFeeCoins: feeByMatchId.get(km.match.id) ?? defaultFee,
      teamCompetitionBadges: badgeByMatchId.get(km.match.id) ?? [],
      knockoutUiState: knockoutUiByMatchId.get(km.matchId) ?? null,
      match: translateMatchTeamsToFa({
        id: km.match.id,
        homeTeamName: km.match.homeTeamName,
        awayTeamName: km.match.awayTeamName,
        leagueName: km.match.leagueName,
        kickoffAt: serializeKickoffAt(km.match.kickoffAt),
        status: km.match.status,
        homeScore: km.match.homeScore,
        awayScore: km.match.awayScore,
      }),
      prediction: predictionMap.get(km.matchId) ?? null,
    })),
  };
}

export async function getKandakatorForDate(userId: string, dateKey?: string) {
  const targetKey = dateKey ?? tehranDateKey(new Date());

  if (await shouldUseMemoryDb()) {
    const existing = devMemoryDb.kandakator.getByDate(targetKey);
    const needsFreshApi =
      isFootballDataConfigured() &&
      (existing?.matches.some(
        (km) =>
          !isMatchResultKnown(km.match) &&
          km.match.kickoffAt.getTime() <= Date.now(),
      ) ??
        false);

    if (needsFreshApi) {
      try {
        await hydrateMemoryKandakatorFromApi(targetKey, { noCache: true });
      } catch {
        // fallback to seed data below
      }
    } else if (!existing && isFootballDataConfigured()) {
      try {
        await hydrateMemoryKandakatorFromApi(targetKey);
      } catch {
        // fallback to seed data below
      }
    }

    const kandakator = devMemoryDb.kandakator.getByDate(targetKey);
    if (!kandakator?.isPublished) return null;
    await settleKandakatorFinishedMatches(kandakator.id);
    return serializeMemoryKandakator(userId, kandakator, targetKey);
  }

  await prepareKandakatorForDisplay(targetKey);

  let kandakator = await loadPublishedKandakatorWithMatches(targetKey);
  const initialDayMatches = kandakator
    ? filterMatchesForTehranDate(kandakator.matches, targetKey)
    : [];

  // Empty day: return fast when a published row already exists. Only do a quick
  // queue pass when nothing is published yet (first load after deploy / cron lag).
  if (initialDayMatches.length === 0 && !kandakator) {
    try {
      const { processKandakatorSyncQueue } = await import(
        "@/server/services/kandakator-sync-queue-processor"
      );
      await processKandakatorSyncQueue(4);
    } catch {
      // background scheduler may still catch up
    }
    kandakator = await loadPublishedKandakatorWithMatches(targetKey);
  }

  void awaitKandakatorScoreRefresh(scoreRefreshDateKeys(targetKey), { waitForUpdate: false });

  if (!kandakator) return null;

  const staleLinkIds = kandakator.matches
    .filter((km) => tehranDateKey(km.match.kickoffAt) !== targetKey)
    .map((km) => km.id);
  if (staleLinkIds.length > 0) {
    void prisma.kandakatorMatch
      .deleteMany({ where: { id: { in: staleLinkIds } } })
      .catch(() => {});
    kandakator = await loadPublishedKandakatorWithMatches(targetKey);
    if (!kandakator) return null;
  }

  const dayMatches = filterMatchesForTehranDate(kandakator.matches, targetKey);
  if (dayMatches.length === 0) {
    if (kandakator.matches.length > 0) {
      return buildKandakatorDto(userId, targetKey, kandakator);
    }
    return null;
  }

  await settleKandakatorFinishedMatches(kandakator.id);

  kandakator = await loadPublishedKandakatorWithMatches(targetKey);
  if (!kandakator) return null;

  return buildKandakatorDto(userId, targetKey, kandakator);
}
