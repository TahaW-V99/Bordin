export type LeaderboardTab = "global" | "teams" | "tournament";

export type GlobalLeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  showcaseSlug: string | null;
  totalXp: number;
  level: string;
  medalCount: number;
};

export type TeamLeaderboardEntry = {
  rank: number;
  teamId: string;
  teamName: string;
  logoUrl: string | null;
  totalPoints: number;
};

export function parseLeaderboardTab(value: string | null | undefined): LeaderboardTab {
  if (value === "teams" || value === "tournament") return value;
  return "global";
}
