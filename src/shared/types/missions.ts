export type MissionCardStatus = "LOCKED" | "IN_PROGRESS" | "READY_TO_CLAIM" | "COMPLETED";

export type MissionTierView = {
  tierKey: string;
  tierLabelFa: string;
  threshold: number;
  coins: number;
  xp: number;
  medalSlug: string | null;
  medalTitleFa: string | null;
  claimed: boolean;
  claimable: boolean;
};

export type MissionCardView = {
  slug: string;
  titleFa: string;
  descriptionFa: string;
  tooltipFa: string;
  status: MissionCardStatus;
  autoClaimOnComplete: boolean;
  currentProgress: number;
  progressTarget: number;
  progressPercent: number;
  claimedTierKeys: string[];
  claimableTierKey: string | null;
  tiers: MissionTierView[];
};

export type MissionClaimResult = {
  missionSlug: string;
  tierKey: string;
  coins: number;
  xp: number;
  medalSlug: string | null;
  medalTitleFa: string | null;
  missionTitleFa: string;
};
