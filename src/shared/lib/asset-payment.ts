/**
 * Shared (client + server) constants for the centralized asset-payment flow.
 *
 * Spending priority enforced everywhere assets are spent (except normal — free —
 * prediction registration): Purchased Coin → Reward Coin → Football Credit
 * (only after explicit user confirmation via the dialog below).
 */

/** Stable code the server returns when Football Credit confirmation is required. */
export const FOOTBALL_CREDIT_CONFIRMATION_CODE = "FOOTBALL_CREDIT_CONFIRMATION_REQUIRED";

/** HTTP status used for the confirmation-required response. */
export const FOOTBALL_CREDIT_CONFIRMATION_STATUS = 402;

/** Confirmation dialog copy (verbatim as specified by the product). */
export const FOOTBALL_CREDIT_DIALOG = {
  lines: [
    "هیچ کدام از سکه‌های جایزه و خریداری شما کافی نیست.",
    "از اعتبار فوتبالیت میخوایی هزینه کنی؟!",
    "من که پیشنهاد نمیکنم!",
    "چون اعتبار فوتبالی به سختی به دست میاد و برای تقویت هویت فوتبالیت باید ازشون استفاده کنی.",
    "با این حال مختاری که انتخاب کنی.",
  ],
  confirmLabel: "استفاده از اعتبار فوتبالی",
  storeLabel: "فروشگاه",
} as const;

/** Shape of the confirmation-required JSON body returned by the API. */
export type FootballCreditConfirmationPayload = {
  code: typeof FOOTBALL_CREDIT_CONFIRMATION_CODE;
  error?: string;
  amount?: number;
  coinBalance?: number;
  footballCredits?: number;
};

export function isFootballCreditConfirmationPayload(
  data: unknown,
): data is FootballCreditConfirmationPayload {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { code?: unknown }).code === FOOTBALL_CREDIT_CONFIRMATION_CODE
  );
}
