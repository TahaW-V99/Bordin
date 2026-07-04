import type { EarnedMedalInput } from "@/shared/lib/honors";

export type PublicTeamShowcaseMember = {
  userId: string;
  name: string;
  role: string;
  roleFa: string;
  globalRank: number | null;
  totalXp: number;
  showcaseSlug: string | null;
};

export type PublicTeamShowcaseCompetition = {
  id: string;
  titleFa: string;
  stage: string;
  rankingScore: number;
};

export type PublicTeamShowcaseData = {
  id: string;
  name: string;
  logoUrl: string | null;
  memberCount: number;
  capacity: number;
  competitionCount: number;
  leaderboardRank: number | null;
  leaderboardTotalPoints: number | null;
  isSuspended: boolean;
  members: PublicTeamShowcaseMember[];
  competitions: PublicTeamShowcaseCompetition[];
  medals: EarnedMedalInput[];
};
