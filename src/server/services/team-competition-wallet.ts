import { CoinTransactionType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";

/** Coin buckets only (purchased + reward). Does not include football credit. */
export async function getUserCoinBalance(userId: string): Promise<number> {
  if (await shouldUseMemoryDb()) {
    const w = devMemoryDb.wallet.getByUserId(userId);
    if (!w) return 0;
    return w.predictionRewardCoins + w.systemRewardCoins + w.purchasedCoins;
  }
  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) return 0;
  return wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;
}

export async function getUserFootballCredits(userId: string): Promise<number> {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.getByUserId(userId)?.footballCredits ?? 0;
  }
  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  return wallet?.footballCredits ?? 0;
}

/** Coins + football credit available toward a cost. */
export async function getUserSpendableAssetBalance(userId: string): Promise<number> {
  const coins = await getUserCoinBalance(userId);
  const credits = await getUserFootballCredits(userId);
  return coins + credits;
}

export async function deductTeamCompetitionEntryFee(
  userId: string,
  amount: number,
  description: string,
) {
  const { deductCoinsWithType } = await import("@/server/services/wallet-service");
  return deductCoinsWithType(
    userId,
    amount,
    CoinTransactionType.TEAM_COMPETITION_ENTRY,
    description,
  );
}

/**
 * Deduct a team-competition fee.
 *
 * - Default: coins only (purchased → reward). Used for other members so we never
 *   spend their Football Credit without their own confirmation.
 * - `useFootballCreditIfNeeded`: allow the centralized asset-payment path
 *   (Football Credit after explicit confirmation via request context). Used for
 *   the registering owner's own fee and owner-covered shortfalls.
 */
export async function tryDeductTeamCompetitionEntryFee(
  userId: string,
  amount: number,
  description: string,
  options: { useFootballCreditIfNeeded?: boolean } = {},
): Promise<{ ok: true } | { ok: false; balance: number }> {
  const cost = Math.floor(amount);
  if (cost <= 0) return { ok: true };

  const coinBalance = await getUserCoinBalance(userId);
  if (coinBalance >= cost) {
    await deductTeamCompetitionEntryFee(userId, cost, description);
    return { ok: true };
  }

  if (!options.useFootballCreditIfNeeded) {
    return { ok: false, balance: coinBalance };
  }

  const credits = await getUserFootballCredits(userId);
  if (coinBalance + credits < cost) {
    return { ok: false, balance: coinBalance };
  }

  // May throw FootballCreditConfirmationRequiredError when not yet confirmed.
  await deductTeamCompetitionEntryFee(userId, cost, description);
  return { ok: true };
}
