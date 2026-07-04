import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { teamLogoUrl } from "@/shared/constants/teams";
import type { TeamLeaderboardEntry } from "@/shared/types/leaderboard";

type TeamLeaderboardRow = {
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  totalPoints: number;
};

function compareTeamLeaderboardRows(a: TeamLeaderboardRow, b: TeamLeaderboardRow) {
  return b.totalPoints - a.totalPoints || a.teamName.localeCompare(b.teamName, "fa");
}

/** Sum ranking + every resolved knockout fixture score for one competition entry. */
export function computeTeamCompetitionEntryPoints(input: {
  rankingScore: number;
  fixtureScoresAsA: number[];
  fixtureScoresAsB: number[];
}): number {
  let total = input.rankingScore;
  for (const score of input.fixtureScoresAsA) total += score;
  for (const score of input.fixtureScoresAsB) total += score;
  return total;
}

/** Pure aggregation used by production and verification tests. */
export function aggregateTeamLeaderboardEntries(
  entries: Array<{
    teamId: string;
    competitionPoints: number;
    teamName: string;
    logoUrl: string | null;
  }>,
): TeamLeaderboardRow[] {
  const aggregated = new Map<string, TeamLeaderboardRow>();
  for (const entry of entries) {
    const existing = aggregated.get(entry.teamId);
    aggregated.set(entry.teamId, {
      teamId: entry.teamId,
      teamName: entry.teamName,
      logoUrl: entry.logoUrl ?? existing?.logoUrl ?? null,
      totalPoints: (existing?.totalPoints ?? 0) + entry.competitionPoints,
    });
  }
  return [...aggregated.values()].sort(compareTeamLeaderboardRows);
}

/** Single source of truth for global team leaderboard ordering. */
export async function buildGlobalTeamLeaderboardRows(): Promise<TeamLeaderboardRow[]> {
  if (await shouldUseMemoryDb()) {
    const cd = (
      globalThis as unknown as {
        __bordinDevDb?: {
          competitionData: {
            teamCompetitionEntries: Array<{ teamId: string; rankingScore: number }>;
            teams: Array<{ id: string; name: string; logoUrl: string | null }>;
          };
        };
      }
    ).__bordinDevDb?.competitionData;
    if (!cd) return [];

    return aggregateTeamLeaderboardEntries(
      cd.teamCompetitionEntries.map((entry) => ({
        teamId: entry.teamId,
        competitionPoints: entry.rankingScore,
        teamName: cd.teams.find((team) => team.id === entry.teamId)?.name ?? "",
        logoUrl: cd.teams.find((team) => team.id === entry.teamId)?.logoUrl ?? null,
      })),
    );
  }

  const entries = await prisma.teamCompetitionEntry.findMany({
    select: {
      rankingScore: true,
      teamId: true,
      team: { select: { name: true, logoKey: true, logoUrl: true } },
      fixturesAsA: {
        where: { resolvedAt: { not: null } },
        select: { entryAScore: true },
      },
      fixturesAsB: {
        where: { resolvedAt: { not: null } },
        select: { entryBScore: true },
      },
    },
  });

  return aggregateTeamLeaderboardEntries(
    entries.map((entry) => ({
      teamId: entry.teamId,
      competitionPoints: computeTeamCompetitionEntryPoints({
        rankingScore: entry.rankingScore,
        fixtureScoresAsA: entry.fixturesAsA.map((fixture) => fixture.entryAScore),
        fixtureScoresAsB: entry.fixturesAsB.map((fixture) => fixture.entryBScore),
      }),
      teamName: entry.team.name,
      logoUrl: entry.team.logoKey ? teamLogoUrl(entry.team.logoKey) : entry.team.logoUrl,
    })),
  );
}

export async function getTeamLeaderboard(): Promise<TeamLeaderboardEntry[]> {
  const rows = await buildGlobalTeamLeaderboardRows();
  return rows.map((row, index) => ({
    rank: index + 1,
    teamId: row.teamId,
    teamName: row.teamName,
    logoUrl: row.logoUrl,
    totalPoints: row.totalPoints,
  }));
}

export async function getTeamLeaderboardRank(teamId: string): Promise<number | null> {
  const leaderboard = await getTeamLeaderboard();
  return leaderboard.find((row) => row.teamId === teamId)?.rank ?? null;
}

export async function getTeamLeaderboardPoints(teamId: string): Promise<number | null> {
  const leaderboard = await getTeamLeaderboard();
  return leaderboard.find((row) => row.teamId === teamId)?.totalPoints ?? null;
}
