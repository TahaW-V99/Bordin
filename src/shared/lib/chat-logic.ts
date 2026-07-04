import { LEVELS } from "@/shared/constants/reward-tables";
import { CHAT_ALLOWED_REACTIONS } from "@/shared/constants/chat";

const AGHAYE_GOL_RANK = LEVELS.find((l) => l.nameFa === "آقای گل")?.rank ?? 6;

export type ChatCredibilityTier = "top5" | "veteran" | "medalist" | null;

export function resolveCredibilityTier(input: {
  globalRank: number | null;
  levelRank: number | null;
  medalCount: number;
}): ChatCredibilityTier {
  if (input.globalRank != null && input.globalRank >= 1 && input.globalRank <= 5) {
    return "top5";
  }
  if (input.levelRank != null && input.levelRank >= AGHAYE_GOL_RANK) {
    return "veteran";
  }
  if (input.medalCount >= 2) {
    return "medalist";
  }
  return null;
}

export function isAllowedChatReaction(emoji: string) {
  return (CHAT_ALLOWED_REACTIONS as readonly string[]).includes(emoji);
}

export function formatSystemMedalMessage(displayName: string, medalTitleFa: string) {
  return `${displayName} مدال ${medalTitleFa} گرفت`;
}

export function formatSystemLevelMessage(displayName: string, levelNameFa: string) {
  return `${displayName} وارد سطح ${levelNameFa} شد`;
}

export function formatSystemPerfectPredictionMessage(displayName: string) {
  return `${displayName} پیش‌بینی ۱۰۰٪ ثبت کرد`;
}
