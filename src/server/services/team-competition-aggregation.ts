import { CompetitionType } from "@prisma/client";

import { prisma } from "@/shared/lib/prisma";

import { shouldUseMemoryDb } from "@/server/db";

import { leagueNameToCompetitionId } from "@/server/services/admin-football-catalog-service";

import {

  getKnockoutRoundMatchIds,

  getRankingStageMatchIds,

  loadRankingStageConfig,

} from "@/server/services/team-competition-stage-resolver";



export { getKnockoutRoundMatchIds, getRankingStageMatchIds };



/** Sum settled xpEarned from DAILY kandakator predictions in the ranking window. */

export async function sumTeamMemberRankingXp(

  teamCompetitionId: string,

  teamId: string,

  matchIds?: string[],

): Promise<number> {

  const members = await prisma.teamMember.findMany({

    where: { teamId },

    select: { userId: true },

  });

  const memberIds = members.map((m) => m.userId);

  if (memberIds.length === 0) return 0;



  const config = await loadRankingStageConfig(teamCompetitionId);



  if (config) {

    const predictions = await prisma.prediction.findMany({

      where: {

        competitionType: CompetitionType.DAILY,

        userId: { in: memberIds },

        OR: [{ scoredAt: { not: null } }, { xpEarned: { not: null } }],

        match: {

          kickoffAt: { gte: config.startsAt, lte: config.endsAt },

        },

      },

      select: {

        xpEarned: true,

        match: { select: { leagueName: true } },

      },

    });



    const leagueIds = new Set(config.footballCompetitionIds);

    return predictions

      .filter((p) =>

        leagueIds.has(leagueNameToCompetitionId(p.match.leagueName ?? "سایر")),

      )

      .reduce((sum, p) => sum + (p.xpEarned ?? 0), 0);

  }



  const ids = matchIds ?? (await getRankingStageMatchIds(teamCompetitionId));

  if (ids.length === 0) return 0;



  const predictions = await prisma.prediction.findMany({

    where: {

      competitionType: CompetitionType.DAILY,

      matchId: { in: ids },

      userId: { in: memberIds },

      OR: [{ scoredAt: { not: null } }, { xpEarned: { not: null } }],

    },

    select: { xpEarned: true },

  });



  return predictions.reduce((sum, p) => sum + (p.xpEarned ?? 0), 0);

}



export async function sumCaptainKnockoutXp(
  _teamCompetitionId: string,
  teamId: string,
  _matchIds: string[],
  knockoutRoundId?: string,
): Promise<number> {
  const { computeCaptainKnockoutStageScore } = await import(
    "@/server/services/team-competition-knockout-qualification"
  );
  if (!knockoutRoundId) return 0;
  return computeCaptainKnockoutStageScore(teamId, knockoutRoundId);
}



export async function countTeamMemberPredictions(

  teamCompetitionId: string,

  teamId: string,

  matchIds: string[],

): Promise<number> {

  if (matchIds.length === 0) return 0;



  const members = await prisma.teamMember.findMany({

    where: { teamId },

    select: { userId: true },

  });



  return prisma.prediction.count({

    where: {

      competitionType: CompetitionType.DAILY,

      matchId: { in: matchIds },

      userId: { in: members.map((m) => m.userId) },

    },

  });

}



export async function countTeamMemberMedals(teamId: string): Promise<number> {

  const members = await prisma.teamMember.findMany({

    where: { teamId },

    select: { userId: true },

  });

  if (members.length === 0) return 0;



  return prisma.userMedal.count({

    where: { userId: { in: members.map((m) => m.userId) } },

  });

}



export async function aggregateRankingScoresForCompetition(teamCompetitionId: string) {

  if (await shouldUseMemoryDb()) return;

  const competition = await prisma.teamCompetition.findUnique({
    where: { id: teamCompetitionId },
    select: { rankingFinalizedAt: true },
  });
  if (competition?.rankingFinalizedAt) return;



  const entries = await prisma.teamCompetitionEntry.findMany({

    where: { teamCompetitionId, isEliminated: false },

    select: { id: true, teamId: true },

  });



  for (const entry of entries) {

    const score = await sumTeamMemberRankingXp(teamCompetitionId, entry.teamId);

    await prisma.teamCompetitionEntry.update({

      where: { id: entry.id },

      data: { rankingScore: score },

    });

  }

  const { syncTeamLeaderboardRanks } = await import(
    "@/server/services/team-leaderboard-rank-service"
  );
  await syncTeamLeaderboardRanks();

}


