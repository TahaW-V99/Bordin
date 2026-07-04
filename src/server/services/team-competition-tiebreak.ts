import type { TeamCompetitionEntry } from "@prisma/client";
import { resolveKnockoutMatchup } from "@/server/services/team-competition-knockout-qualification";

export const TIEBREAK_PREDICTION_BONUS = 100;
export const TIEBREAK_MEDAL_BONUS = 200;

export type KnockoutFixtureScore = {
  entryAScore: number;
  entryBScore: number;
  winnerEntryId: string;
  loserEntryId: string;
  tieBreakApplied: boolean;
  tieBreakWinnerId: string | null;
};

/** @deprecated Use resolveKnockoutMatchup — kept for call-site compatibility. */
export async function resolveKnockoutFixtureScores(input: {
  teamCompetitionId: string;
  knockoutRoundId: string;
  entryAId: string;
  entryBId: string;
  entryAScore?: number;
  entryBScore?: number;
  matchIds?: string[];
  entryA: Pick<TeamCompetitionEntry, "id" | "teamId" | "seedRank" | "knockoutRoundScoreBaseline">;
  entryB: Pick<TeamCompetitionEntry, "id" | "teamId" | "seedRank" | "knockoutRoundScoreBaseline">;
}): Promise<KnockoutFixtureScore> {
  return resolveKnockoutMatchup({
    knockoutRoundId: input.knockoutRoundId,
    entryAId: input.entryAId,
    entryBId: input.entryBId,
    entryA: input.entryA,
    entryB: input.entryB,
  });
}
