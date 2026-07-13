import { normalizePhone } from "@/shared/lib/phone";

export type ClientKandakatorMatch = {
  id: string;
  matchId: string;
  sortOrder: number;
  predictionCutoffMinutes: number;
  entryFeeCoins?: number;
  teamCompetitionBadges?: Array<{ id: string; titleFa: string; label: string }>;
  knockoutUiState?: {
    role: "captain" | "member";
    message: string | null;
    canSubmit: boolean;
  } | null;
  watchParty?: {
    roomId: string;
    matchId: string;
    capacity: number;
    entryFeeCoins: number;
    occupiedCount: number;
    hasJoined: boolean;
    uiPhase: "upcoming" | "active";
    googleMeetUrl: string | null;
  } | null;
  match: {
    id: string;
    homeTeamName: string;
    awayTeamName: string;
    leagueName: string | null;
    kickoffAt: string;
    status: string;
    homeScore: number | null;
    awayScore: number | null;
  };
  prediction: {
    homePrediction: number;
    awayPrediction: number;
    accuracyPercent: number | null;
    coinsEarned: number | null;
    xpEarned: number | null;
  } | null;
};

export function userNeedsDisplayName(phone: string, displayName: string | null | undefined) {
  if (!displayName?.trim()) return true;
  return normalizePhone(displayName) === normalizePhone(phone);
}

export function groupMatchesByLeague(matches: ClientKandakatorMatch[]) {
  const groups = new Map<string, ClientKandakatorMatch[]>();
  for (const item of matches) {
    const league = item.match.leagueName?.trim() || "سایر مسابقات";
    const list = groups.get(league) ?? [];
    list.push(item);
    groups.set(league, list);
  }
  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b, "fa"))
    .map(([leagueName, leagueMatches]) => ({
      leagueName,
      matches: leagueMatches.sort((a, b) => a.sortOrder - b.sortOrder),
    }));
}
