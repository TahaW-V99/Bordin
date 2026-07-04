import type { TeamCompetitionKnockoutRoundType } from "@prisma/client";

export const TEAM_COMPETITION_CAPACITY_OPTIONS = [8, 16, 32] as const;
export type TeamCompetitionCapacity = (typeof TEAM_COMPETITION_CAPACITY_OPTIONS)[number];

export const KNOCKOUT_ROUND_LABELS_FA: Record<TeamCompetitionKnockoutRoundType, string> = {
  ONE_SIXTEENTH: "یک‌شانزدهم",
  ONE_EIGHTH: "یک‌هشتم",
  ONE_QUARTER: "یک‌چهارم",
  FINAL: "فینال",
};

export function knockoutRoundsForCapacity(
  capacity: TeamCompetitionCapacity,
): TeamCompetitionKnockoutRoundType[] {
  if (capacity === 8) return ["ONE_QUARTER", "FINAL"];
  if (capacity === 16) return ["ONE_EIGHTH", "ONE_QUARTER", "FINAL"];
  return ["ONE_SIXTEENTH", "ONE_EIGHTH", "ONE_QUARTER", "FINAL"];
}

export const TEAM_SUSPENSION_NOTIFICATION = {
  suspended: {
    titleFa: "تعلیق تیم",
    bodyFa: "مدیریت بُردین تیم شما رو به دلیل نقض قوانین از ادامه فعالیت منع کرده!",
  },
  unsuspended: {
    titleFa: "رفع تعلیق تیم",
    bodyFa: "مدیریت بُردین اجازه فعالیت مجدد به تیم شما رو صادر کرده",
  },
};
