import { TeamCompetitionStage } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { leagueNameToCompetitionId } from "@/server/services/admin-football-catalog-service";
import type { MatchForPredictionFee } from "@/server/services/team-competition-prediction-fee-service";

export type TeamCompetitionKandakatorBadge = {
  id: string;
  titleFa: string;
  label: string;
};

function isKickoffInWindow(kickoffAt: Date, startsAt: Date, endsAt: Date) {
  const ms = kickoffAt.getTime();
  return ms >= startsAt.getTime() && ms <= endsAt.getTime();
}

function resolveFootballCompetitionId(match: MatchForPredictionFee) {
  return leagueNameToCompetitionId(match.leagueName ?? "سایر");
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
    where: { teamId: { in: teamIds } },
    include: {
      teamCompetition: {
        select: {
          id: true,
          titleFa: true,
          stage: true,
          rankingStartsAt: true,
          rankingEndsAt: true,
          usesRuleBasedStages: true,
          rankingFootballCompetitions: { select: { footballCompetitionId: true } },
          knockoutRounds: {
            orderBy: { sortOrder: "asc" },
            select: {
              startsAt: true,
              endsAt: true,
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

async function loadLegacyStageMatchIdsByCompetition(compIds: string[]) {
  const legacyIds = compIds.filter(Boolean);
  if (legacyIds.length === 0) return new Map<string, Set<string>>();

  const rows = await prisma.teamCompetitionStageMatch.findMany({
    where: { teamCompetitionId: { in: legacyIds } },
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

function matchBelongsToTeamCompetition(
  match: MatchForPredictionFee,
  comp: Awaited<ReturnType<typeof getUserActiveRegisteredTeamCompetitions>>[number],
  legacyStageMatchIds: Map<string, Set<string>>,
) {
  if (comp.usesRuleBasedStages) {
    const footballCompetitionId = resolveFootballCompetitionId(match);

    const rankingIds = new Set(
      comp.rankingFootballCompetitions.map((r) => r.footballCompetitionId),
    );
    if (
      isKickoffInWindow(match.kickoffAt, comp.rankingStartsAt, comp.rankingEndsAt) &&
      rankingIds.has(footballCompetitionId)
    ) {
      return true;
    }

    for (const round of comp.knockoutRounds) {
      if (!round.startsAt || !round.endsAt) continue;
      const roundIds = new Set(round.footballCompetitions.map((r) => r.footballCompetitionId));
      if (
        isKickoffInWindow(match.kickoffAt, round.startsAt, round.endsAt) &&
        roundIds.has(footballCompetitionId)
      ) {
        return true;
      }
    }

    return false;
  }

  return legacyStageMatchIds.get(comp.id)?.has(match.id) ?? false;
}

function buildBadge(comp: { id: string; titleFa: string }): TeamCompetitionKandakatorBadge {
  return {
    id: comp.id,
    titleFa: comp.titleFa,
    label: `رقابت‌های دوستانه (${comp.titleFa})`,
  };
}

/** Team-competition status badges for kandakator matches (registered team members only). */
export async function resolveTeamCompetitionBadgesForMatches(
  userId: string,
  matches: MatchForPredictionFee[],
): Promise<Map<string, TeamCompetitionKandakatorBadge[]>> {
  const result = new Map<string, TeamCompetitionKandakatorBadge[]>();
  for (const match of matches) {
    result.set(match.id, []);
  }

  if (matches.length === 0 || (await shouldUseMemoryDb())) {
    return result;
  }

  const comps = await getUserActiveRegisteredTeamCompetitions(userId);
  if (comps.length === 0) return result;

  const legacyCompIds = comps.filter((c) => !c.usesRuleBasedStages).map((c) => c.id);
  const legacyStageMatchIds = await loadLegacyStageMatchIdsByCompetition(legacyCompIds);

  for (const match of matches) {
    const badges: TeamCompetitionKandakatorBadge[] = [];
    for (const comp of comps) {
      if (matchBelongsToTeamCompetition(match, comp, legacyStageMatchIds)) {
        badges.push(buildBadge(comp));
      }
    }
    result.set(match.id, badges);
  }

  return result;
}
