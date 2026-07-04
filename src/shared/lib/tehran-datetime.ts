import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TEHRAN_TZ } from "@/shared/lib/dates";

/** HTML datetime-local value (Tehran wall clock) → UTC Date */
export function tehranLocalInputToDate(localValue: string): Date {
  if (!localValue) throw new Error("تاریخ و ساعت الزامی است");
  const normalized = localValue.length === 16 ? `${localValue}:00` : localValue;
  return fromZonedTime(normalized, TEHRAN_TZ);
}

/** UTC Date → HTML datetime-local value in Tehran */
export function dateToTehranLocalInput(date: Date | string): string {
  const instant = new Date(date);
  if (Number.isNaN(instant.getTime())) return "";
  return formatInTimeZone(instant, TEHRAN_TZ, "yyyy-MM-dd'T'HH:mm");
}

/** Latest kickoff among matches (for auto end-date display) */
export function latestKickoffAt(kickoffs: Array<Date | string>): Date | null {
  let max: number | null = null;
  for (const k of kickoffs) {
    const ms = new Date(k).getTime();
    if (!Number.isFinite(ms)) continue;
    if (max === null || ms > max) max = ms;
  }
  return max === null ? null : new Date(max);
}
