/**
 * Thrown by the centralized asset-payment resolver when a user does not have
 * enough Purchased + Reward coins to cover a cost, but the remainder *could* be
 * paid with Football Credit. Football Credit is never spent automatically; the
 * client must re-issue the request with explicit user confirmation.
 */
export class FootballCreditConfirmationRequiredError extends Error {
  /** Total amount that must be paid. */
  readonly amount: number;
  /** Combined coin balance (purchased + reward) available toward the cost. */
  readonly coinBalance: number;
  /** Football Credit balance available to cover the remainder. */
  readonly footballCredits: number;

  constructor(amount: number, coinBalance: number, footballCredits: number) {
    super("FOOTBALL_CREDIT_CONFIRMATION_REQUIRED");
    this.name = "FootballCreditConfirmationRequiredError";
    this.amount = amount;
    this.coinBalance = coinBalance;
    this.footballCredits = footballCredits;
    Object.setPrototypeOf(this, FootballCreditConfirmationRequiredError.prototype);
  }
}

/** Stable code used by API routes / clients to detect the confirmation flow. */
export const FOOTBALL_CREDIT_CONFIRMATION_CODE = "FOOTBALL_CREDIT_CONFIRMATION_REQUIRED" as const;
