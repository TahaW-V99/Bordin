import { SHEBA_DIGITS_LENGTH } from "@/shared/constants/wallet";

export function normalizeShebaDigits(input: string) {
  return input.replace(/\D/g, "").replace(/^IR/i, "");
}

export function validateShebaDigits(digits: string) {
  if (digits.length !== SHEBA_DIGITS_LENGTH) {
    throw new Error(`شماره شبا باید ${SHEBA_DIGITS_LENGTH} رقم باشد`);
  }
  if (!/^\d+$/.test(digits)) {
    throw new Error("شماره شبا فقط باید شامل ارقام باشد");
  }
}

export function formatShebaDisplay(digits: string) {
  return `IR${digits}`;
}
