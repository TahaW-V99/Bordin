const PERSIAN_LETTER_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
const LATIN_LETTER_RE = /[A-Za-z]/;
const ALLOWED_RE =
  /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u06F0-\u06F90-9 \u200c]+$/;

/** Collapse whitespace and trim — keeps internal spaces between words. */
export function normalizeTeamNameInput(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export function countPersianLetters(name: string) {
  return (name.match(PERSIAN_LETTER_RE) ?? []).length;
}

export function validateTeamName(name: string): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = normalizeTeamNameInput(name);
  const persianCount = countPersianLetters(trimmed);

  if (persianCount < 3) {
    return { ok: false, error: "نام تیم باید حداقل شامل ۳ حرف فارسی باشد" };
  }
  if (persianCount > 10) {
    return { ok: false, error: "اسم نباید بیش از ۱۰ حرف باشد" };
  }
  if (LATIN_LETTER_RE.test(trimmed)) {
    return { ok: false, error: "استفاده از حروف انگلیسی مجاز نیست" };
  }
  if (!ALLOWED_RE.test(trimmed)) {
    return { ok: false, error: "استفاده از علامت در نام تیم مجاز نیست" };
  }
  return { ok: true, value: trimmed };
}
