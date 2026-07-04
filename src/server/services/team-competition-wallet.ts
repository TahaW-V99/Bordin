import { CoinTransactionType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";

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

export async function deductTeamCompetitionEntryFee(
  userId: string,
  amount: number,
  description: string,
) {
  const { deductCoinsWithType } = await import("@/server/services/wallet-service");
  return deductCoinsWithType(userId, amount, CoinTransactionType.TEAM_COMPETITION_ENTRY, description);
}

export async function tryDeductTeamCompetitionEntryFee(
  userId: string,
  amount: number,
  description: string,
): Promise<{ ok: true } | { ok: false; balance: number }> {
  const balance = await getUserCoinBalance(userId);
  if (balance < amount) return { ok: false, balance };
  await deductTeamCompetitionEntryFee(userId, amount, description);
  return { ok: true };
}
