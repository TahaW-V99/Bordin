import { format as formatJalali } from "date-fns-jalali";
import { faIR as faIRJalali } from "date-fns-jalali/locale/fa-IR";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

const TEHRAN_TZ = "Asia/Tehran";

function toTehran(date: Date | string) {
  return toZonedTime(new Date(parseInstant(date)), TEHRAN_TZ);
}

export function toPersianDigits(value: string | number) {
  return String(value).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

function formatShamsi(date: Date | string, pattern: string) {
  const formatted = formatJalali(toTehran(date), pattern, { locale: faIRJalali });
  return toPersianDigits(formatted);
}

/** روز هفته + روز و ماه شمسی — مثلاً «شنبه ۲۰ خرداد» */
export function formatTehranDate(date: Date | string, pattern = "EEEE d MMMM") {
  return formatShamsi(date, pattern);
}

/** ساعت به وقت تهران با ارقام فارسی */
export function formatTehranTime(date: Date | string) {
  const instant = parseInstant(date);
  return toPersianDigits(formatInTimeZone(new Date(instant), TEHRAN_TZ, "HH:mm"));
}

/** تاریخ و ساعت شمسی — مثلاً «۲۰ خرداد ۱۴۰۵ - ۱۸:۳۰» */
export function formatTehranDateTime(date: Date | string) {
  const shamsiDate = formatShamsi(date, "d MMMM yyyy");
  const time = formatInTimeZone(new Date(parseInstant(date)), TEHRAN_TZ, "HH:mm");
  return `${shamsiDate} - ${toPersianDigits(time)}`;
}

/** نمایش کوتاه — مثلاً «۲۰ خرداد» */
export function formatShamsiShort(date: Date | string) {
  return formatShamsi(date, "d MMM");
}

/** نام روز هفته شمسی — مثلاً «شنبه» */
export function formatShamsiWeekday(date: Date | string) {
  return formatShamsi(date, "EEEE");
}

/** تاریخ کامل شمسی — مثلاً «۲۰ خرداد ۱۴۰۵» */
export function formatShamsiDateWithYear(date: Date | string) {
  return formatShamsi(date, "d MMMM yyyy");
}

/** تبدیل کلید YYYY-MM-DD (میلادی) به تاریخ شمسی نمایشی */
export function formatShamsiFromDateKey(dateKey: string, pattern = "d MMMM yyyy") {
  return formatShamsi(`${dateKey}T12:00:00+03:30`, pattern);
}

/** حداقل ۵ دقیقه قبل از شروع — حتی اگر مقدار قدیمی در دیتابیس باشد. */
export function effectivePredictionCutoffMinutes(cutoffMinutes: number | null | undefined) {
  return Math.max(5, cutoffMinutes ?? 5);
}

const MS_PER_MINUTE = 60_000;

function hasExplicitTimezone(raw: string) {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw);
}

/** MySQL DATETIME / ISO بدون منطقه — در دیتابیس به‌صورت UTC ذخیره شده است. */
function parseUtcNaiveDatetime(raw: string) {
  const normalized = raw.trim().replace(" ", "T");
  return Date.parse(hasExplicitTimezone(normalized) ? normalized : `${normalized}Z`);
}

/**
 * خواندن لحظهٔ زمانی از دیتابیس یا رابط برنامه.
 * - رشته با Z یا offset → همان لحظهٔ جهانی
 * - ISO با میلی‌ثانیه یا فرمت MySQL بدون منطقه → UTC
 * - رشتهٔ ساده YYYY-MM-DDTHH:mm:ss (بدون ms) → وقت تهران (دادهٔ قدیمی)
 */
export function parseInstant(value: Date | string): number {
  if (value instanceof Date) return value.getTime();
  const raw = String(value).trim();
  if (!raw) return NaN;
  if (hasExplicitTimezone(raw)) {
    return Date.parse(raw);
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}\.\d{1,3}$/.test(raw)) {
    return parseUtcNaiveDatetime(raw);
  }
  if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(raw)) {
    const tehranStyle = raw.includes("T") && !raw.includes(" ");
    if (tehranStyle) {
      return fromZonedTime(raw.replace(" ", "T"), TEHRAN_TZ).getTime();
    }
    return parseUtcNaiveDatetime(raw);
  }
  return Date.parse(raw);
}

/**
 * زمان شروع بازی را برای ارسال به مرورگر یکسان می‌کند (همیشه UTC با پسوند Z).
 * این کار جلوی اختلاف شمارنده و ساعت نمایشی را می‌گیرد.
 */
export function serializeKickoffAt(value: Date | string): string {
  const ms = parseInstant(value);
  if (!Number.isFinite(ms)) {
    return value instanceof Date ? value.toISOString() : String(value);
  }
  return new Date(ms).toISOString();
}

/** True when value is a valid instant. */
export function isValidInstant(value: Date | string) {
  return Number.isFinite(parseInstant(value));
}

/** Instant when predictions close (kickoff minus cutoff), timezone-safe. */
export function getPredictionDeadlineInstant(
  kickoffAt: Date | string,
  cutoffMinutes: number | null | undefined = 5,
) {
  const cutoff = effectivePredictionCutoffMinutes(cutoffMinutes);
  return parseInstant(kickoffAt) - cutoff * MS_PER_MINUTE;
}

export function getRemainingMs(target: Date | string) {
  return Math.max(0, parseInstant(target) - Date.now());
}

export function getRemainingMsUntilPredictionDeadline(
  kickoffAt: Date | string,
  cutoffMinutes: number | null | undefined = 5,
) {
  return Math.max(0, getPredictionDeadlineInstant(kickoffAt, cutoffMinutes) - Date.now());
}

export function formatCountdown(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const raw =
    hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      : `${minutes}:${String(seconds).padStart(2, "0")}`;
  return toPersianDigits(raw);
}

export function formatPersianNumber(value: number) {
  return toPersianDigits(value.toLocaleString("fa-IR"));
}

export { TEHRAN_TZ };

/** Stable UTC midnight for MySQL DATE column (matches yyyy-MM-dd keys). */
export function kandakatorDateFromKey(dateKey: string) {
  return new Date(`${dateKey}T00:00:00.000Z`);
}
