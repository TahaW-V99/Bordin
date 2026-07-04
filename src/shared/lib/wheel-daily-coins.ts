import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { subDays } from "date-fns";
import { TEHRAN_TZ } from "@/shared/lib/dates";

export function getLastThreeTehranDayKeys() {
  const tehranNow = toZonedTime(new Date(), TEHRAN_TZ);
  const keys: string[] = [];
  for (let daysAgo = 2; daysAgo >= 0; daysAgo--) {
    keys.push(formatInTimeZone(subDays(tehranNow, daysAgo), TEHRAN_TZ, "yyyy-MM-dd"));
  }
  return keys;
}

export function tehranDayBounds(dateKey: string) {
  const start = fromZonedTime(`${dateKey}T00:00:00`, TEHRAN_TZ);
  const end = fromZonedTime(`${dateKey}T23:59:59.999`, TEHRAN_TZ);
  return { start, end };
}

export function coinAmountInTehranDay(createdAt: Date, dateKey: string) {
  const { start, end } = tehranDayBounds(dateKey);
  return createdAt >= start && createdAt <= end;
}
