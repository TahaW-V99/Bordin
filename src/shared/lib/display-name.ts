export const DISPLAY_NAME_MIN_LENGTH = 4;
export const DISPLAY_NAME_MAX_LENGTH = 16;

export const DISPLAY_NAME_TAKEN_ERROR_FA = "این نام کاربری قبلا استفاده شده";

/** حروف فارسی (شامل ی/ي و ک/ك رایج در کیبورد) */
const PERSIAN_LETTERS = "آابپتثجچحخدذرزژسشصضطظعغفقکكگلمنوههیيئ";

/** اعداد فارسی ۰–۹ */
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** حروف انگلیسی a-z / A-Z */
const ENGLISH_LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** اعداد انگلیسی 0-9 */
const ENGLISH_DIGITS = "0123456789";

const LETTER_SET = new Set([...PERSIAN_LETTERS]);
const DIGIT_SET = new Set([...PERSIAN_DIGITS]);
const ENGLISH_LETTER_SET = new Set([...ENGLISH_LETTERS]);
const ENGLISH_DIGIT_SET = new Set([...ENGLISH_DIGITS]);

export const DISPLAY_NAME_RULES_FA = [
  "نام باید حداقل شامل یک حرف فارسی یا انگلیسی باشد",
  "فقط حروف فارسی یا انگلیسی، اعداد فارسی یا انگلیسی و فاصله مجاز است",
  "علامت و نماد (مثل ؟) مجاز نیست",
  `طول نام بین ${DISPLAY_NAME_MIN_LENGTH} تا ${DISPLAY_NAME_MAX_LENGTH} کاراکتر`,
] as const;

export function validateDisplayName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");

  if (trimmed.length < DISPLAY_NAME_MIN_LENGTH || trimmed.length > DISPLAY_NAME_MAX_LENGTH) {
    throw new Error(
      `نام باید بین ${DISPLAY_NAME_MIN_LENGTH} تا ${DISPLAY_NAME_MAX_LENGTH} کاراکتر باشد`,
    );
  }

  let hasLetter = false;

  for (const char of trimmed) {
    if (char === " ") {
      continue;
    }
    if (LETTER_SET.has(char)) {
      hasLetter = true;
      continue;
    }
    if (ENGLISH_LETTER_SET.has(char)) {
      hasLetter = true;
      continue;
    }
    if (DIGIT_SET.has(char)) {
      continue;
    }
    if (ENGLISH_DIGIT_SET.has(char)) {
      continue;
    }
    throw new Error(
      "نام فقط می‌تواند شامل حروف فارسی یا انگلیسی، اعداد فارسی یا انگلیسی و فاصله باشد؛ بدون علامت",
    );
  }

  if (!hasLetter) {
    throw new Error("نام باید حداقل شامل یک حرف فارسی یا انگلیسی باشد");
  }

  return trimmed;
}

export function getDisplayNameValidationError(raw: string): string | null {
  try {
    validateDisplayName(raw);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "نام نامعتبر است";
  }
}
