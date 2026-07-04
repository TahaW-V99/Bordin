import { parseInstant } from "@/shared/lib/dates";

/** آیا نتیجه نهایی بازی (هر دو گل) مشخص است؟ */
export function isMatchResultKnown(match: {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
}) {
  return match.status === "FINISHED" && match.homeScore !== null && match.awayScore !== null;
}

/** آیا زمان شروع بازی گذشته است؟ */
export function hasKickoffPassed(kickoffAt: string | Date) {
  return Date.now() >= parseInstant(kickoffAt);
}

/** آیا بازی برای نمایش «تمام‌شده» در کنداکتور آماده است؟ */
export function isMatchFinishedForDisplay(
  match: {
    status: string;
    homeScore: number | null;
    awayScore: number | null;
    kickoffAt: string | Date;
  },
  predictionCutoffMinutes?: number | null,
) {
  if (isMatchResultKnown(match)) return true;
  if (match.status === "FINISHED") return true;
  void predictionCutoffMinutes;
  return false;
}
