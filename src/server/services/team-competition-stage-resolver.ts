import {
  TeamCompetitionMatchStage,
  TeamCompetitionStage,
  type MatchStatus,
  type TeamCompetitionKnockoutRoundType,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import {
  filterCatalogMatchesByStageRules,
  loadCatalogMatchesInRange,
  upsertFootballMatchesByExternalIds,
} from "@/server/services/admin-football-catalog-service";

export type StageWindowConfig = {
  startsAt: Date;
  endsAt: Date;
  footballCompetitionIds: number[];
};

export type ResolvedStageMatch = {
  matchId: string;
  externalId: string;
  kickoffAt: Date;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
};

function isMatchSettled(row: {
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}) {
  if (row.status === "CANCELLED") return true;
  return row.status === "FINISHED" && row.homeScore !== null && row.awayScore !== null;
}

export async function resolveEligibleCatalogMatches(config: StageWindowConfig) {
  const catalog = await loadCatalogMatchesInRange(config.startsAt, config.endsAt);
  return filterCatalogMatchesByStageRules(
    catalog,
    config.startsAt,
    config.endsAt,
    config.footballCompetitionIds,
  );
}

export async function resolveEligibleStageMatches(
  config: StageWindowConfig,
): Promise<ResolvedStageMatch[]> {
  const eligible = await resolveEligibleCatalogMatches(config);
  if (eligible.length === 0) return [];

  const upserted = await upsertFootballMatchesByExternalIds(
    eligible.map((m) => m.externalId),
  );
  const upsertedByExternal = new Map(upserted.map((m) => [m.externalId, m.matchId]));

  const matchIds = eligible
    .map((m) => upsertedByExternal.get(m.externalId) ?? m.matchId)
    .filter((id): id is string => Boolean(id));

  const dbRows = await prisma.footballMatch.findMany({
    where: { id: { in: matchIds } },
    select: {
      id: true,
      externalId: true,
      kickoffAt: true,
      status: true,
      homeScore: true,
      awayScore: true,
    },
  });

  return dbRows
    .map((row) => ({
      matchId: row.id,
      externalId: row.externalId ?? "",
      kickoffAt: row.kickoffAt,
      status: row.status,
      homeScore: row.homeScore,
      awayScore: row.awayScore,
    }))
    .sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
}

/** Optional cache sync — configuration rules remain source of truth. */
export async function syncStageMatchCache(input: {
  teamCompetitionId: string;
  stage: TeamCompetitionMatchStage;
  knockoutRoundId?: string | null;
  config: StageWindowConfig;
}) {
  const resolved = await resolveEligibleStageMatches(input.config);
  const resolvedIds = new Set(resolved.map((m) => m.matchId));

  const existing = await prisma.teamCompetitionStageMatch.findMany({
    where: {
      teamCompetitionId: input.teamCompetitionId,
      stage: input.stage,
      knockoutRoundId: input.knockoutRoundId ?? null,
    },
    select: { id: true, matchId: true },
  });

  const toRemove = existing.filter((row) => !resolvedIds.has(row.matchId));
  if (toRemove.length > 0) {
    await prisma.teamCompetitionStageMatch.deleteMany({
      where: { id: { in: toRemove.map((r) => r.id) } },
    });
  }

  const existingIds = new Set(existing.map((r) => r.matchId));
  const toAdd = resolved.filter((m) => !existingIds.has(m.matchId));
  if (toAdd.length > 0) {
    await prisma.teamCompetitionStageMatch.createMany({
      data: toAdd.map((m, sortOrder) => ({
        teamCompetitionId: input.teamCompetitionId,
        stage: input.stage,
        knockoutRoundId: input.knockoutRoundId ?? null,
        matchId: m.matchId,
        sortOrder,
        kickoffAt: m.kickoffAt,
      })),
      skipDuplicates: true,
    });
  }
}

export async function isRuleBasedStageComplete(
  config: StageWindowConfig,
): Promise<boolean> {
  const matches = await resolveEligibleStageMatches(config);
  if (matches.length === 0) return false;
  return matches.every(isMatchSettled);
}

export async function loadRankingStageConfig(teamCompetitionId: string): Promise<StageWindowConfig | null> {
  const comp = await prisma.teamCompetition.findUnique({
    where: { id: teamCompetitionId },
    select: {
      usesRuleBasedStages: true,
      rankingStartsAt: true,
      rankingEndsAt: true,
      rankingFootballCompetitions: { select: { footballCompetitionId: true } },
    },
  });
  if (!comp?.usesRuleBasedStages) return null;
  return {
    startsAt: comp.rankingStartsAt,
    endsAt: comp.rankingEndsAt,
    footballCompetitionIds: comp.rankingFootballCompetitions.map((r) => r.footballCompetitionId),
  };
}

export async function loadKnockoutRoundStageConfig(
  knockoutRoundId: string,
): Promise<StageWindowConfig | null> {
  const round = await prisma.teamCompetitionKnockoutRound.findUnique({
    where: { id: knockoutRoundId },
    include: {
      teamCompetition: { select: { usesRuleBasedStages: true } },
      footballCompetitions: { select: { footballCompetitionId: true } },
    },
  });
  if (!round?.teamCompetition.usesRuleBasedStages || !round.startsAt || !round.endsAt) return null;
  return {
    startsAt: round.startsAt,
    endsAt: round.endsAt,
    footballCompetitionIds: round.footballCompetitions.map((r) => r.footballCompetitionId),
  };
}

export async function getRankingStageMatchIds(teamCompetitionId: string): Promise<string[]> {
  const comp = await prisma.teamCompetition.findUnique({
    where: { id: teamCompetitionId },
    select: { usesRuleBasedStages: true },
  });
  if (!comp?.usesRuleBasedStages) {
    const rows = await prisma.teamCompetitionStageMatch.findMany({
      where: { teamCompetitionId, stage: TeamCompetitionMatchStage.RANKING },
      select: { matchId: true },
    });
    return rows.map((r) => r.matchId);
  }

  const config = await loadRankingStageConfig(teamCompetitionId);
  if (!config) return [];
  await syncStageMatchCache({
    teamCompetitionId,
    stage: TeamCompetitionMatchStage.RANKING,
    config,
  });
  const resolved = await resolveEligibleStageMatches(config);
  return resolved.map((m) => m.matchId);
}

export async function getKnockoutRoundMatchIds(knockoutRoundId: string): Promise<string[]> {
  const round = await prisma.teamCompetitionKnockoutRound.findUnique({
    where: { id: knockoutRoundId },
    include: { teamCompetition: { select: { id: true, usesRuleBasedStages: true } } },
  });
  if (!round) return [];

  if (!round.teamCompetition.usesRuleBasedStages) {
    const rows = await prisma.teamCompetitionStageMatch.findMany({
      where: { knockoutRoundId },
      select: { matchId: true },
    });
    return rows.map((r) => r.matchId);
  }

  const config = await loadKnockoutRoundStageConfig(knockoutRoundId);
  if (!config) return [];
  await syncStageMatchCache({
    teamCompetitionId: round.teamCompetition.id,
    stage: TeamCompetitionMatchStage.KNOCKOUT,
    knockoutRoundId,
    config,
  });
  const resolved = await resolveEligibleStageMatches(config);
  return resolved.map((m) => m.matchId);
}

export async function syncAllRuleBasedStageCaches(teamCompetitionId: string) {
  const comp = await prisma.teamCompetition.findUnique({
    where: { id: teamCompetitionId },
    select: {
      usesRuleBasedStages: true,
      knockoutRounds: { orderBy: { sortOrder: "asc" }, select: { id: true } },
    },
  });
  if (!comp?.usesRuleBasedStages) return;

  const rankingConfig = await loadRankingStageConfig(teamCompetitionId);
  if (rankingConfig) {
    await syncStageMatchCache({
      teamCompetitionId,
      stage: TeamCompetitionMatchStage.RANKING,
      config: rankingConfig,
    });
  }

  for (const round of comp.knockoutRounds) {
    const config = await loadKnockoutRoundStageConfig(round.id);
    if (!config) continue;
    await syncStageMatchCache({
      teamCompetitionId,
      stage: TeamCompetitionMatchStage.KNOCKOUT,
      knockoutRoundId: round.id,
      config,
    });
  }
}

export type KnockoutRoundRef = {
  id: string;
  roundType: TeamCompetitionKnockoutRoundType;
  sortOrder: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

function matchFitsDateWindow(kickoffAt: Date, startsAt: Date, endsAt: Date) {
  const kickoffMs = kickoffAt.getTime();
  return kickoffMs >= startsAt.getTime() && kickoffMs <= endsAt.getTime();
}

/** Rule-based competitions whose configured windows may include this match (date pre-filter). */
export async function findRuleBasedCompetitionIdsForSettledMatch(matchId: string): Promise<string[]> {
  const match = await prisma.footballMatch.findUnique({
    where: { id: matchId },
    select: { kickoffAt: true },
  });
  if (!match) return [];

  const comps = await prisma.teamCompetition.findMany({
    where: {
      isPublished: true,
      usesRuleBasedStages: true,
      stage: { in: [TeamCompetitionStage.RANKING, TeamCompetitionStage.KNOCKOUT] },
    },
    select: {
      id: true,
      stage: true,
      rankingStartsAt: true,
      rankingEndsAt: true,
      knockoutRounds: {
        orderBy: { sortOrder: "asc" },
        select: { startsAt: true, endsAt: true },
      },
    },
  });

  const affected: string[] = [];
  for (const comp of comps) {
    if (comp.stage === TeamCompetitionStage.RANKING) {
      if (matchFitsDateWindow(match.kickoffAt, comp.rankingStartsAt, comp.rankingEndsAt)) {
        affected.push(comp.id);
      }
      continue;
    }

    for (const round of comp.knockoutRounds) {
      if (!round.startsAt || !round.endsAt) continue;
      if (matchFitsDateWindow(match.kickoffAt, round.startsAt, round.endsAt)) {
        affected.push(comp.id);
        break;
      }
    }
  }
  return affected;
}
