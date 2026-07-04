export type PredictionResultSharePayload = {
  predictionId: string;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string | null;
  homePrediction: number;
  awayPrediction: number;
  homeScore: number;
  awayScore: number;
  accuracyPercent: number;
  coinsEarned: number;
  xpEarned: number;
};

export type DuelChallengePayload = {
  duelId: string;
  challengerId: string;
  challengerName: string;
  opponentId: string;
  opponentName: string;
  matches: Array<{
    matchId: string;
    homeTeamName: string;
    awayTeamName: string;
    kickoffAt: string;
  }>;
};

export function isPredictionResultPayload(
  value: unknown,
): value is PredictionResultSharePayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return typeof p.predictionId === "string" && typeof p.homeTeamName === "string";
}

export function isDuelChallengePayload(value: unknown): value is DuelChallengePayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return typeof p.duelId === "string" && Array.isArray(p.matches);
}
