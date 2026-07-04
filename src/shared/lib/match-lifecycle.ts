import { hasKickoffPassed, isMatchResultKnown } from "@/shared/lib/match-result";

/** Authoritative match lifecycle states — derived from DB fields only */
export type MatchLifecycleState =
  | "SCHEDULED"
  | "LIVE"
  | "AWAITING_RESULT"
  | "RESULT_KNOWN"
  | "FINISHED"
  | "CANCELLED"
  | "POSTPONED";

/** Prediction results tab categories — derived from match + prediction DB state */
export type PredictionCategory = "registered" | "result_determined" | "scored";

export type MatchLifecycleInput = {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  kickoffAt: string | Date;
};

export type PredictionLifecycleInput = {
  scoredAt: string | Date | null;
};

export type MatchConsistencyIssue =
  | "finished_without_scores"
  | "scores_without_finished_status"
  | "partial_scores"
  | "stale_awaiting_result"
  | "orphan_live_past_kickoff";

export function deriveMatchLifecycleState(match: MatchLifecycleInput): MatchLifecycleState {
  if (match.status === "CANCELLED") return "CANCELLED";
  if (match.status === "POSTPONED") return "POSTPONED";

  if (isMatchResultKnown(match)) {
    return match.status === "FINISHED" ? "FINISHED" : "RESULT_KNOWN";
  }

  if (match.status === "LIVE") return "LIVE";
  if (hasKickoffPassed(match.kickoffAt)) return "AWAITING_RESULT";
  return "SCHEDULED";
}

/** Result is final enough to move prediction out of "registered" */
export function isMatchResultFinalForClassification(match: MatchLifecycleInput) {
  const state = deriveMatchLifecycleState(match);
  return state === "RESULT_KNOWN" || state === "FINISHED";
}

export function derivePredictionCategory(
  prediction: PredictionLifecycleInput,
  match: MatchLifecycleInput,
): PredictionCategory {
  if (prediction.scoredAt !== null) return "scored";
  if (isMatchResultFinalForClassification(match)) return "result_determined";
  return "registered";
}

export function isPredictionCategorySettled(category: PredictionCategory) {
  return category !== "registered";
}

export function predictionFilterMatchesCategory(
  filter: "pending" | "settled",
  category: PredictionCategory,
) {
  return filter === "settled"
    ? isPredictionCategorySettled(category)
    : category === "registered";
}

export function detectMatchConsistencyIssues(match: MatchLifecycleInput): MatchConsistencyIssue[] {
  const issues: MatchConsistencyIssue[] = [];
  const hasHome = match.homeScore !== null;
  const hasAway = match.awayScore !== null;

  if (hasHome !== hasAway) {
    issues.push("partial_scores");
  }

  if (match.status === "FINISHED" && !isMatchResultKnown(match)) {
    issues.push("finished_without_scores");
  }

  if (isMatchResultKnown(match) && match.status !== "FINISHED" && match.status !== "LIVE") {
    issues.push("scores_without_finished_status");
  }

  const state = deriveMatchLifecycleState(match);
  if (state === "AWAITING_RESULT" && hasKickoffPassed(match.kickoffAt)) {
    const hoursSinceKickoff =
      (Date.now() - new Date(match.kickoffAt).getTime()) / (60 * 60 * 1000);
    if (hoursSinceKickoff >= 3) {
      issues.push("stale_awaiting_result");
    }
  }

  if (match.status === "LIVE" && hasKickoffPassed(match.kickoffAt)) {
    const hoursSinceKickoff =
      (Date.now() - new Date(match.kickoffAt).getTime()) / (60 * 60 * 1000);
    if (hoursSinceKickoff >= 4 && !isMatchResultKnown(match)) {
      issues.push("orphan_live_past_kickoff");
    }
  }

  return issues;
}

/** Finished match must show scores in fixture list */
export function mustDisplayFixtureScore(match: MatchLifecycleInput) {
  const state = deriveMatchLifecycleState(match);
  return (state === "FINISHED" || state === "RESULT_KNOWN") && isMatchResultKnown(match);
}

export function fixtureScoreDisplayViolation(match: MatchLifecycleInput) {
  if (!mustDisplayFixtureScore(match)) return null;
  if (isMatchResultKnown(match)) return null;
  return "finished_match_missing_scores" as const;
}
