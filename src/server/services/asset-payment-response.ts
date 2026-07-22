import { NextResponse } from "next/server";
import { FootballCreditConfirmationRequiredError } from "@/server/services/asset-payment-errors";
import {
  FOOTBALL_CREDIT_CONFIRMATION_CODE,
  FOOTBALL_CREDIT_CONFIRMATION_STATUS,
} from "@/shared/lib/asset-payment";

/**
 * If `error` is a {@link FootballCreditConfirmationRequiredError}, returns the
 * standard confirmation-required JSON response so the client can prompt the
 * user; otherwise returns null and the caller falls back to normal error
 * handling. Use in every spend route's catch block:
 *
 *   const confirm = footballCreditConfirmationResponse(error);
 *   if (confirm) return confirm;
 */
export function footballCreditConfirmationResponse(error: unknown): NextResponse | null {
  if (error instanceof FootballCreditConfirmationRequiredError) {
    return NextResponse.json(
      {
        code: FOOTBALL_CREDIT_CONFIRMATION_CODE,
        error: "برای پرداخت این هزینه باید استفاده از اعتبار فوتبالی را تأیید کنی",
        amount: error.amount,
        coinBalance: error.coinBalance,
        footballCredits: error.footballCredits,
      },
      { status: FOOTBALL_CREDIT_CONFIRMATION_STATUS },
    );
  }
  return null;
}
