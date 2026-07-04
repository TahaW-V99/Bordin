import { TeamCompetitionMatchStage, TeamCompetitionStage } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { leagueNameToCompetitionId } from "@/server/services/admin-football-catalog-service";

export type MatchForPredictionFee = {
  id: string;
  kickoffAt: Date;
  leagueName: string | null;
  externalId: string | null;
};

function isKickoffInWindow(kickoffAt: Date, startsAt: Date, endsAt: Date) {
  const ms = kickoffAt.getTime();
  return ms >= startsAt.getTime() && ms <= endsAt.getTime();
}

async function getUserActiveRegisteredTeamCompetitions(userId: string) {
  const teamIds = (
    await prisma.teamMember.findMany({
      where: { userId },
      select: { teamId: true },
    })
  ).map((m) => m.teamId);

  if (teamIds.length === 0) return [];

  const entries = await prisma.teamCompetitionEntry.findMany({
    where: { teamId: { in: teamIds }, isEliminated: false },
    include: {
      teamCompetition: {
        select: {
          id: true,
          stage: true,
          rankingStartsAt: true,
          rankingEndsAt: true,
          rankingPredictionFeePerMember: true,
          usesRuleBasedStages: true,
          rankingFootballCompetitions: { select: { footballCompetitionId: true } },
          knockoutRounds: {
            orderBy: { sortOrder: "asc" },
            select: {
              startsAt: true,
              endsAt: true,
              predictionFeePerMember: true,
              footballCompetitions: { select: { footballCompetitionId: true } },
            },
          },
        },
      },
    },
  });

  return entries
    .filter((e) => e.teamCompetition.stage !== TeamCompetitionStage.FINISHED)
    .map((e) => e.teamCompetition);
}

async function loadLegacyRankingMatchIdsByCompetition(compIds: string[]) {
  const legacyIds = compIds.filter(Boolean);
  if (legacyIds.length === 0) return new Map<string, Set<string>>();

  const rows = await prisma.teamCompetitionStageMatch.findMany({
    where: {
      teamCompetitionId: { in: legacyIds },
      stage: TeamCompetitionMatchStage.RANKING,
    },
    select: { teamCompetitionId: true, matchId: true },
  });

  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = map.get(row.teamCompetitionId) ?? new Set<string>();
    set.add(row.matchId);
    map.set(row.teamCompetitionId, set);
  }
  return map;
}

async function loadLegacyKnockoutMatchIdsByCompetition(compIds: string[]) {
  const legacyIds = compIds.filter(Boolean);
  if (legacyIds.length === 0) return new Map<string, Set<string>>();

  const rows = await prisma.teamCompetitionStageMatch.findMany({
    where: {
      teamCompetitionId: { in: legacyIds },
      stage: TeamCompetitionMatchStage.KNOCKOUT,
    },
    select: { teamCompetitionId: true, matchId: true },
  });

  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const set = map.get(row.teamCompetitionId) ?? new Set<string>();
    set.add(row.matchId);
    map.set(row.teamCompetitionId, set);
  }
  return map;
}

function resolveFootballCompetitionId(match: MatchForPredictionFee) {
  return leagueNameToCompetitionId(match.leagueName ?? "سایر");
}

function resolveKnockoutFeeForMatch(
  match: MatchForPredictionFee,
  comp: Awaited<ReturnType<typeof getUserActiveRegisteredTeamCompetitions>>[number],
  legacyKnockoutMatchIds: Map<string, Set<string>>,
) {
  if (comp.stage !== TeamCompetitionStage.KNOCKOUT) return null;

  if (comp.usesRuleBasedStages) {
    const footballCompetitionId = resolveFootballCompetitionId(match);
    for (const round of comp.knockoutRounds) {
      if (!round.startsAt || !round.endsAt) continue;
      const roundIds = new Set(round.footballCompetitions.map((r) => r.footballCompetitionId));
      if (
        isKickoffInWindow(match.kickoffAt, round.startsAt, round.endsAt) &&
        roundIds.has(footballCompetitionId)
      ) {
        return round.predictionFeePerMember;
      }
    }
    return null;
  }

  if (legacyKnockoutMatchIds.get(comp.id)?.has(match.id)) {
    const firstRound = comp.knockoutRounds[0];
    return firstRound?.predictionFeePerMember ?? null;
  }

  return null;
}

function resolveFeeForMatch(
  match: MatchForPredictionFee,
  defaultFee: number,
  comps: Awaited<ReturnType<typeof getUserActiveRegisteredTeamCompetitions>>,
  legacyRankingMatchIds: Map<string, Set<string>>,
  legacyKnockoutMatchIds: Map<string, Set<string>>,
) {
  const footballCompetitionId = resolveFootballCompetitionId(match);

  for (const comp of comps) {
    const knockoutFee = resolveKnockoutFeeForMatch(match, comp, legacyKnockoutMatchIds);
    if (knockoutFee != null) {
      return knockoutFee;
    }

    let qualifiesRanking = false;

    if (comp.usesRuleBasedStages) {
      const rankingIds = new Set(
        comp.rankingFootballCompetitions.map((r) => r.footballCompetitionId),
      );
      qualifiesRanking =
        isKickoffInWindow(match.kickoffAt, comp.rankingStartsAt, comp.rankingEndsAt) &&
        rankingIds.has(footballCompetitionId);
    } else {
      qualifiesRanking = legacyRankingMatchIds.get(comp.id)?.has(match.id) ?? false;
    }

    if (qualifiesRanking) {
      return comp.rankingPredictionFeePerMember;
    }
  }

  return defaultFee;
}

/** Per-match daily prediction fee; team-comp ranking/knockout fee when applicable. */
export async function resolveDailyPredictionEntryFeesForMatches(
  userId: string,
  matches: MatchForPredictionFee[],
  defaultFee: number,
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  for (const match of matches) {
    result.set(match.id, defaultFee);
  }

  if (matches.length === 0 || (await shouldUseMemoryDb())) {
    return result;
  }

  const comps = await getUserActiveRegisteredTeamCompetitions(userId);
  if (comps.length === 0) return result;

  const legacyCompIds = comps.filter((c) => !c.usesRuleBasedStages).map((c) => c.id);
  const legacyRankingMatchIds = await loadLegacyRankingMatchIdsByCompetition(legacyCompIds);
  const legacyKnockoutMatchIds = await loadLegacyKnockoutMatchIdsByCompetition(legacyCompIds);

  for (const match of matches) {
    result.set(
      match.id,
      resolveFeeForMatch(match, defaultFee, comps, legacyRankingMatchIds, legacyKnockoutMatchIds),
    );
  }

  return result;
}

export async function resolveDailyPredictionEntryFee(
  userId: string,
  match: MatchForPredictionFee,
  defaultFee: number,
): Promise<number> {
  const fees = await resolveDailyPredictionEntryFeesForMatches(userId, [match], defaultFee);
  return fees.get(match.id) ?? defaultFee;
}
