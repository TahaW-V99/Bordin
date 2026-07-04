import {
  derivePredictionCategory,
  isMatchResultFinalForClassification,
  isPredictionCategorySettled,
  predictionFilterMatchesCategory,
} from "@/shared/lib/match-lifecycle";

export type PredictionResultFilter = "pending" | "settled";

export type PredictionResultItem = {
  id: string;
  homePrediction: number;
  awayPrediction: number;
  entryFeeCoins: number;
  accuracyPercent: number | null;
  coinsEarned: number | null;
  xpEarned: number | null;
  scoredAt: string | null;
  submittedAt: string;
  competitionType: string;
  competitionRefId: string | null;
  medal: {
    id: string;
    titleFa: string;
    tier: string;
  } | null;
  match: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    leagueName: string | null;
    kickoffAt: string;
    homeScore: number | null;
    awayScore: number | null;
    status: string;
  };
};

/** Authoritative: result final when lifecycle state says so (scores + status rules) */
export function isMatchResultDetermined(
  match: Pick<PredictionResultItem["match"], "status" | "homeScore" | "awayScore" | "kickoffAt">,
) {
  return isMatchResultFinalForClassification(match);
}

/** Tab filter: derived from DB state via lifecycle state machine */
export function isPredictionSettled(
  item: Pick<PredictionResultItem, "match" | "scoredAt">,
) {
  const category = derivePredictionCategory(item, item.match);
  return isPredictionCategorySettled(category);
}

export function getPredictionCategory(
  item: Pick<PredictionResultItem, "match" | "scoredAt">,
) {
  return derivePredictionCategory(item, item.match);
}

/** امتیاز و سکه جایزه ثبت شده */
export function isPredictionScored(item: Pick<PredictionResultItem, "scoredAt">) {
  return item.scoredAt !== null;
}

export function parsePredictionResultFilter(
  value: string | null | undefined,
): PredictionResultFilter {
  return value === "settled" ? "settled" : "pending";
}

export function filterPredictionResultsByTab(
  items: PredictionResultItem[],
  filter: PredictionResultFilter,
) {
  return items.filter((item) => {
    const category = derivePredictionCategory(item, item.match);
    return predictionFilterMatchesCategory(filter, category);
  });
}
