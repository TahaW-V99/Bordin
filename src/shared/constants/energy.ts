export const ENERGY_MAX_PERCENT = 100;
export const ENERGY_AUTO_RECOVERY_HOURS = 6;
export const ENERGY_AUTO_RECOVERY_PERCENT = 50;
export const ENERGY_INVITE_RECOVERY_PERCENT = 10;
export const ENERGY_INVITE_RECOVERY_MAX_INVITES = 10;

export const ENERGY_ACTIVITIES = [
  "PREDICTION",
  "TEAM_COMPETITION_REGISTRATION",
  "CUP_REGISTRATION",
  "TOURNAMENT_REGISTRATION",
  "TEAM_CREATION",
  "PRIVATE_CHAT",
  "TEAM_JOIN_REQUEST",
  "TEAM_MEMBER_SELECTION",
  "LUCKY_WHEEL_SPIN",
] as const;

export type EnergyActivity = (typeof ENERGY_ACTIVITIES)[number];

export const ENERGY_ACTIVITY_LABELS_FA: Record<EnergyActivity, string> = {
  PREDICTION: "ثبت پیش‌بینی",
  TEAM_COMPETITION_REGISTRATION: "ثبت‌نام رقابت تیمی",
  CUP_REGISTRATION: "ثبت‌نام جام",
  TOURNAMENT_REGISTRATION: "ثبت‌نام تورنمنت",
  TEAM_CREATION: "ساخت تیم",
  PRIVATE_CHAT: "چت خصوصی",
  TEAM_JOIN_REQUEST: "درخواست عضویت در تیم",
  TEAM_MEMBER_SELECTION: "انتخاب عضو تیم",
  LUCKY_WHEEL_SPIN: "چرخش گردونه شانس",
};

export const ENERGY_ACTIVITY_COUNTER_KEYS: Record<
  EnergyActivity,
  | "predictionCount"
  | "teamCompetitionRegCount"
  | "cupRegCount"
  | "tournamentRegCount"
  | "teamCreationCount"
  | "privateChatCount"
  | "teamJoinRequestCount"
  | "teamMemberSelectionCount"
  | "luckyWheelSpinCount"
> = {
  PREDICTION: "predictionCount",
  TEAM_COMPETITION_REGISTRATION: "teamCompetitionRegCount",
  CUP_REGISTRATION: "cupRegCount",
  TOURNAMENT_REGISTRATION: "tournamentRegCount",
  TEAM_CREATION: "teamCreationCount",
  PRIVATE_CHAT: "privateChatCount",
  TEAM_JOIN_REQUEST: "teamJoinRequestCount",
  TEAM_MEMBER_SELECTION: "teamMemberSelectionCount",
  LUCKY_WHEEL_SPIN: "luckyWheelSpinCount",
};

export type EnergyCostsMap = Record<EnergyActivity, number>;

export const DEFAULT_ENERGY_COSTS: EnergyCostsMap = {
  PREDICTION: 0,
  TEAM_COMPETITION_REGISTRATION: 0,
  CUP_REGISTRATION: 0,
  TOURNAMENT_REGISTRATION: 0,
  TEAM_CREATION: 0,
  PRIVATE_CHAT: 0,
  TEAM_JOIN_REQUEST: 0,
  TEAM_MEMBER_SELECTION: 0,
  LUCKY_WHEEL_SPIN: 0,
};

export const ENERGY_RECOVERY_MODE_DEFAULT = "DEFAULT_6H_50" as const;
export const ENERGY_RECOVERY_MODE_INVITE = "INVITE_FRIENDS" as const;

export type EnergyRecoveryMode =
  | typeof ENERGY_RECOVERY_MODE_DEFAULT
  | typeof ENERGY_RECOVERY_MODE_INVITE;

export const ENERGY_UPDATED_EVENT = "bordin:energy-updated";

export const ENERGY_INSUFFICIENT_CODE = "ENERGY_INSUFFICIENT";

/** Ledger event types — extend here for future features. */
export const ENERGY_LEDGER_EVENT_TYPES = [
  "ENERGY_CONSUMED",
  "ENERGY_RECOVERED_BY_TIME",
  "ENERGY_RECOVERED_BY_INVITE",
  "ENERGY_PURCHASED",
  "ENERGY_ADJUSTED_BY_ADMIN",
  "ENERGY_BONUS",
] as const;

export type EnergyLedgerEventType = (typeof ENERGY_LEDGER_EVENT_TYPES)[number];
