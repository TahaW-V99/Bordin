import { CoinTransactionType, CoinType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { devMemoryDb } from "@/server/dev-memory-db";
import { shouldUseMemoryDb } from "@/server/db";
import { FootballCreditConfirmationRequiredError } from "@/server/services/asset-payment-errors";
import { isFootballCreditAllowed } from "@/server/services/asset-payment-context";

export type ProcessAssetPaymentOptions = {
  /** Transaction type recorded for the coin portion of the payment. */
  type: CoinTransactionType;
  /** Coin bucket label recorded on the transaction. */
  coinType: CoinType;
  /** Human-readable description recorded on the transaction. */
  description: string;
  /**
   * When true, Football Credit may cover any remainder after coins are
   * exhausted. Requires explicit user confirmation; defaults to false.
   */
  allowFootballCredit?: boolean;
  /** Optional reference id recorded on the transaction. */
  referenceId?: string;
};

/**
 * Centralized asset-payment resolver. Enforces the single application-wide
 * spending priority for every feature that spends user assets (EXCEPT normal —
 * now free — prediction registration):
 *
 *   1. Purchased Coin
 *   2. Reward Coin (system reward, then legacy prediction-reward bucket)
 *   3. Football Credit — only after explicit user confirmation
 *      (`allowFootballCredit: true`), otherwise a
 *      {@link FootballCreditConfirmationRequiredError} is thrown so the client
 *      can prompt the user.
 */
export async function processAssetPayment(
  userId: string,
  amount: number,
  options: ProcessAssetPaymentOptions,
) {
  const cost = Math.floor(amount);
  if (cost <= 0) return null;

  // Football Credit is allowed if the caller passed the flag explicitly OR the
  // current request confirmed it via the asset-payment context.
  const allowFootballCredit = (options.allowFootballCredit ?? false) || isFootballCreditAllowed();

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.spendAssets(userId, cost, allowFootballCredit);
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول یافت نشد");

  const coinBalance =
    wallet.purchasedCoins + wallet.systemRewardCoins + wallet.predictionRewardCoins;

  if (coinBalance < cost) {
    if (coinBalance + wallet.footballCredits < cost) {
      throw new Error("موجودی کافی نیست");
    }
    if (!allowFootballCredit) {
      throw new FootballCreditConfirmationRequiredError(
        cost,
        coinBalance,
        wallet.footballCredits,
      );
    }
  }

  let remaining = cost;
  let purchDeduct = 0;
  let sysDeduct = 0;
  let predDeduct = 0;

  const spendFrom = (available: number, bucket: "purch" | "sys" | "pred") => {
    const take = Math.min(available, remaining);
    remaining -= take;
    if (bucket === "purch") purchDeduct = take;
    if (bucket === "sys") sysDeduct = take;
    if (bucket === "pred") predDeduct = take;
  };

  spendFrom(wallet.purchasedCoins, "purch");
  spendFrom(wallet.systemRewardCoins, "sys");
  spendFrom(wallet.predictionRewardCoins, "pred");

  // Any remainder is covered by Football Credit (already confirmed above).
  const footballDeduct = remaining;
  const coinPortion = cost - footballDeduct;

  // Sequential update + transaction record (no wrapping $transaction) so this can
  // safely run inside callers that already hold an interactive transaction —
  // matching the convention of the other wallet helpers.
  const updated = await prisma.coinWallet.update({
    where: { userId },
    data: {
      purchasedCoins: wallet.purchasedCoins - purchDeduct,
      systemRewardCoins: wallet.systemRewardCoins - sysDeduct,
      predictionRewardCoins: wallet.predictionRewardCoins - predDeduct,
      ...(footballDeduct > 0
        ? { footballCredits: Math.max(0, wallet.footballCredits - footballDeduct) }
        : {}),
    },
  });

  const balanceAfter =
    updated.purchasedCoins + updated.systemRewardCoins + updated.predictionRewardCoins;

  if (coinPortion > 0) {
    await prisma.coinTransaction.create({
      data: {
        walletId: updated.id,
        coinType: options.coinType,
        amount: -coinPortion,
        balanceAfter,
        type: options.type,
        description: options.description,
        ...(options.referenceId ? { referenceId: options.referenceId } : {}),
      },
    });
  }

  return updated;
}

/**
 * Non-mutating preflight for the confirmation flow. Call this BEFORE any
 * mutating side effect (e.g. consuming energy) in features whose coin
 * deduction happens after such side effects, so the confirmation dialog is
 * raised on the first attempt without executing side effects twice on the
 * confirmed retry.
 *
 * Throws {@link FootballCreditConfirmationRequiredError} only when coins are
 * insufficient, Football Credit could cover the remainder, and the user has
 * NOT confirmed. It intentionally does NOT throw for a truly-insufficient
 * balance — that case is left to the real deduction so existing behavior is
 * preserved.
 */
export async function assertFootballCreditConfirmationSatisfied(
  userId: string,
  amount: number,
) {
  const cost = Math.floor(amount);
  if (cost <= 0) return;
  if (isFootballCreditAllowed()) return;

  let purchased = 0;
  let system = 0;
  let prediction = 0;
  let football = 0;

  if (await shouldUseMemoryDb()) {
    const w = devMemoryDb.wallet.getByUserId(userId);
    if (!w) return;
    purchased = w.purchasedCoins;
    system = w.systemRewardCoins;
    prediction = w.predictionRewardCoins;
    football = w.footballCredits ?? 0;
  } else {
    const w = await prisma.coinWallet.findUnique({ where: { userId } });
    if (!w) return;
    purchased = w.purchasedCoins;
    system = w.systemRewardCoins;
    prediction = w.predictionRewardCoins;
    football = w.footballCredits;
  }

  const coinBalance = purchased + system + prediction;
  if (coinBalance >= cost) return;
  if (coinBalance + football < cost) return;

  throw new FootballCreditConfirmationRequiredError(cost, coinBalance, football);
}
