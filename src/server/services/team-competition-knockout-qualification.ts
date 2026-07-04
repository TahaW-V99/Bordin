import { CompetitionType, TeamRole } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { leagueNameToCompetitionId } from "@/server/services/admin-football-catalog-service";
import {
  getKnockoutRoundMatchIds,
  loadKnockoutRoundStageConfig,
} from "@/server/services/team-competition-stage-resolver";
import { countTeamMemberMedals } from "@/server/services/team-competition-aggregation";

export const KNOCKOUT_TIEBREAK_PREDICTION_BONUS = 100;
export const KNOCKOUT_TIEBREAK_MEDAL_BONUS = 200;

/** Captain predicts in knockout; owner only if no captain is assigned. */
export async function getKnockoutCaptainUserId(teamId: string): Promise<string | null> {
  const members = await prisma.teamMember.findMany({
    where: { teamId, role: { in: [TeamRole.CAPTAIN, TeamRole.OWNER] } },
    select: { userId: true, role: true },
  });
  const captain = members.find((m) => m.role === TeamRole.CAPTAIN);
  const owner = members.find((m) => m.role === TeamRole.OWNER);
  return captain?.userId ?? owner?.userId ?? null;
}

/**
 * Team stage score for one knockout round = sum of captain xpEarned from DAILY
 * predictions in that round's configured window (never carries from prior rounds).
 */
export async function computeCaptainKnockoutStageScore(
  teamId: string,
  knockoutRoundId: string,
): Promise<number> {
  const captainUserId = await getKnockoutCaptainUserId(teamId);
  if (!captainUserId) return 0;

  const config = await loadKnockoutRoundStageConfig(knockoutRoundId);

  if (config) {
    const predictions = await prisma.prediction.findMany({
      where: {
        userId: captainUserId,
        competitionType: CompetitionType.DAILY,
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

  const matchIds = await getKnockoutRoundMatchIds(knockoutRoundId);
  if (matchIds.length === 0) return 0;

  const predictions = await prisma.prediction.findMany({
    where: {
      userId: captainUserId,
      competitionType: CompetitionType.DAILY,
      matchId: { in: matchIds },
      OR: [{ scoredAt: { not: null } }, { xpEarned: { not: null } }],
    },
    select: { xpEarned: true },
  });

  return predictions.reduce((sum, p) => sum + (p.xpEarned ?? 0), 0);
}

/** امتیاز کل مرحله حذفی = پایه import + پیش‌بینی‌های کاپیتان در بازه. */
export async function computeCaptainKnockoutStageTotalScore(
  teamId: string,
  knockoutRoundId: string,
  baseline = 0,
): Promise<number> {
  const live = await computeCaptainKnockoutStageScore(teamId, knockoutRoundId);
  return baseline + live;
}

/** Total predictions submitted by all team members during the knockout round window. */
export async function countKnockoutRoundMemberPredictions(
  teamId: string,
  knockoutRoundId: string,
): Promise<number> {
  const members = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });
  const memberIds = members.map((m) => m.userId);
  if (memberIds.length === 0) return 0;

  const config = await loadKnockoutRoundStageConfig(knockoutRoundId);

  if (config) {
    const predictions = await prisma.prediction.findMany({
      where: {
        competitionType: CompetitionType.DAILY,
        userId: { in: memberIds },
        match: {
          kickoffAt: { gte: config.startsAt, lte: config.endsAt },
        },
      },
      select: { match: { select: { leagueName: true } } },
    });

    const leagueIds = new Set(config.footballCompetitionIds);
    return predictions.filter((p) =>
      leagueIds.has(leagueNameToCompetitionId(p.match.leagueName ?? "سایر")),
    ).length;
  }

  const matchIds = await getKnockoutRoundMatchIds(knockoutRoundId);
  if (matchIds.length === 0) return 0;

  return prisma.prediction.count({
    where: {
      competitionType: CompetitionType.DAILY,
      matchId: { in: matchIds },
      userId: { in: memberIds },
    },
  });
}

export type KnockoutMatchupResult = {
  entryAScore: number;
  entryBScore: number;
  winnerEntryId: string;
  loserEntryId: string;
  tieBreakApplied: boolean;
  tieBreakWinnerId: string | null;
};

export async function resolveKnockoutMatchup(input: {
  knockoutRoundId: string;
  entryAId: string;
  entryBId: string;
  entryA: { id: string; teamId: string; seedRank: number | null; knockoutRoundScoreBaseline?: number };
  entryB: { id: string; teamId: string; seedRank: number | null; knockoutRoundScoreBaseline?: number };
}): Promise<KnockoutMatchupResult> {
  let scoreA = await computeCaptainKnockoutStageTotalScore(
    input.entryA.teamId,
    input.knockoutRoundId,
    input.entryA.knockoutRoundScoreBaseline ?? 0,
  );
  let scoreB = await computeCaptainKnockoutStageTotalScore(
    input.entryB.teamId,
    input.knockoutRoundId,
    input.entryB.knockoutRoundScoreBaseline ?? 0,
  );
  let tieBreakApplied = false;
  let tieBreakWinnerId: string | null = null;

  const pickWinner = (a: number, b: number) => (a > b ? input.entryAId : input.entryBId);

  if (scoreA !== scoreB) {
    const winnerEntryId = pickWinner(scoreA, scoreB);
    return {
      entryAScore: scoreA,
      entryBScore: scoreB,
      winnerEntryId,
      loserEntryId: winnerEntryId === input.entryAId ? input.entryBId : input.entryAId,
      tieBreakApplied: false,
      tieBreakWinnerId: null,
    };
  }

  const [predA, predB, medalA, medalB] = await Promise.all([
    countKnockoutRoundMemberPredictions(input.entryA.teamId, input.knockoutRoundId),
    countKnockoutRoundMemberPredictions(input.entryB.teamId, input.knockoutRoundId),
    countTeamMemberMedals(input.entryA.teamId),
    countTeamMemberMedals(input.entryB.teamId),
  ]);

  if (predA !== predB) {
    tieBreakApplied = true;
    tieBreakWinnerId = predA > predB ? input.entryAId : input.entryBId;
    if (predA > predB) scoreA += KNOCKOUT_TIEBREAK_PREDICTION_BONUS;
    else scoreB += KNOCKOUT_TIEBREAK_PREDICTION_BONUS;

    if (scoreA !== scoreB) {
      const winnerEntryId = pickWinner(scoreA, scoreB);
      return {
        entryAScore: scoreA,
        entryBScore: scoreB,
        winnerEntryId,
        loserEntryId: winnerEntryId === input.entryAId ? input.entryBId : input.entryAId,
        tieBreakApplied,
        tieBreakWinnerId,
      };
    }
  }

  if (medalA !== medalB) {
    tieBreakApplied = true;
    tieBreakWinnerId = medalA > medalB ? input.entryAId : input.entryBId;
    if (medalA > medalB) scoreA += KNOCKOUT_TIEBREAK_MEDAL_BONUS;
    else scoreB += KNOCKOUT_TIEBREAK_MEDAL_BONUS;
  }

  if (scoreA !== scoreB) {
    const winnerEntryId = pickWinner(scoreA, scoreB);
    return {
      entryAScore: scoreA,
      entryBScore: scoreB,
      winnerEntryId,
      loserEntryId: winnerEntryId === input.entryAId ? input.entryBId : input.entryAId,
      tieBreakApplied,
      tieBreakWinnerId,
    };
  }

  const seedA = input.entryA.seedRank ?? Number.MAX_SAFE_INTEGER;
  const seedB = input.entryB.seedRank ?? Number.MAX_SAFE_INTEGER;
  tieBreakApplied = true;
  tieBreakWinnerId = seedA <= seedB ? input.entryAId : input.entryBId;
  const winnerEntryId = tieBreakWinnerId;

  return {
    entryAScore: scoreA,
    entryBScore: scoreB,
    winnerEntryId,
    loserEntryId: winnerEntryId === input.entryAId ? input.entryBId : input.entryAId,
    tieBreakApplied,
    tieBreakWinnerId,
  };
}

/** Reset per-round knockout scores when a new knockout round begins. */
export async function resetActiveEntryKnockoutRoundScores(teamCompetitionId: string) {
  await prisma.teamCompetitionEntry.updateMany({
    where: { teamCompetitionId, isEliminated: false },
    data: { knockoutRoundScore: 0 },
  });
}
