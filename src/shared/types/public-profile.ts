import type { EarnedMedalInput } from "@/shared/lib/honors";
import type { HonorItem } from "@/shared/lib/honors";

export type PublicProfileStats = {
  totalPredictions: number;
  perfectPredictions: number;
  accuracyPercent: number | null;
  cupsEntered: number;
  tournamentsEntered: number;
  teamCompetitionsEntered: number;
};

export type PublicProfileTeam = {
  id: string;
  name: string;
  logoUrl: string | null;
  competitionId: string | null;
};

export type PublicProfileData = {
  showcaseSlug: string;
  displayName: string;
  avatarUrl: string | null;
  level: string | null;
  totalXp: number;
  globalRank: number | null;
  teamName: string | null;
  teams: PublicProfileTeam[];
  joinedAt: string;
  stats: PublicProfileStats;
  medals: EarnedMedalInput[];
  honors: HonorItem[];
};

export function publicTeamShowcaseHref(team: PublicProfileTeam) {
  return `/showcase/team/${team.id}`;
}

export const PUBLIC_PROFILE_SHARE_MESSAGE =
  "مایلم پروفایل افتخاراتم رو در بُردین با شما به اشتراک بگذارم. لطفا روی لینک کلیک کن که متوجه جایگاه خاص من در بُردین بشی.";
