const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** Convert Persian/Arabic numerals to ASCII 0-9 */
export function toAsciiDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (ch) => {
    const persianIndex = PERSIAN_DIGITS.indexOf(ch);
    if (persianIndex >= 0) return String(persianIndex);
    const arabicIndex = ARABIC_DIGITS.indexOf(ch);
    if (arabicIndex >= 0) return String(arabicIndex);
    return ch;
  });
}

export function normalizePhone(phone: string) {
  const digits = toAsciiDigits(phone).replace(/\D/g, "");

  if (digits.startsWith("98") && digits.length === 12) {
    return `0${digits.slice(2)}`;
  }
  if (digits.startsWith("0098") && digits.length === 14) {
    return `0${digits.slice(4)}`;
  }
  if (digits.startsWith("9") && digits.length === 10) {
    return `0${digits}`;
  }
  if (digits.startsWith("09") && digits.length === 11) {
    return digits;
  }

  return digits;
}

export function isValidIranMobile(phone: string) {
  return /^09\d{9}$/.test(normalizePhone(phone));
}
