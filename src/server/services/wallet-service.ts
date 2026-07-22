import { CoinTransactionType, CoinType, XpTransactionType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { devMemoryDb } from "@/server/dev-memory-db";
import { shouldUseMemoryDb } from "@/server/db";
import { processAssetPayment } from "@/server/services/asset-payment-service";
import type { TicketWalletField } from "@/shared/constants/tickets";

/**
 * Deduct coins for a feature that spends assets. Delegates to the centralized
 * {@link processAssetPayment} so the shared spending priority
 * (purchased → reward → football credit) is enforced. When purchased + reward coins are
 * insufficient, football credit is only used if `allowFootballCredit` is true (explicit
 * user confirmation); otherwise a FootballCreditConfirmationRequiredError is thrown.
 */
export async function deductCoins(
  userId: string,
  amount: number,
  description: string,
  allowFootballCredit = false,
) {
  return processAssetPayment(userId, amount, {
    type: CoinTransactionType.PREDICTION_ENTRY,
    coinType: CoinType.PURCHASED,
    description,
    allowFootballCredit,
  });
}

export async function deductCoinsWithType(
  userId: string,
  amount: number,
  type: CoinTransactionType,
  description: string,
  allowFootballCredit = false,
) {
  return processAssetPayment(userId, amount, {
    type,
    coinType: CoinType.SYSTEM_REWARD,
    description,
    allowFootballCredit,
  });
}

/**
 * Grant reward coins. Historically wrote to predictionRewardCoins; the product
 * model now has a single "سکه جایزه" bucket (systemRewardCoins), so new grants
 * go there. Existing predictionRewardCoins are merged by
 * prisma/migrate-prediction-coins-to-system.mjs.
 */
export async function addPredictionRewardCoins(
  userId: string,
  amount: number,
  type: CoinTransactionType,
  description: string,
) {
  return addSystemRewardCoins(userId, amount, type, description);
}

/** Positive or negative adjustment after prediction re-scoring. */
export async function adjustSystemRewardCoins(
  userId: string,
  delta: number,
  description: string,
) {
  if (delta === 0) return null;
  if (delta > 0) {
    return addSystemRewardCoins(
      userId,
      delta,
      CoinTransactionType.PREDICTION_REWARD,
      description,
    );
  }

  const amount = Math.abs(delta);
  if (await shouldUseMemoryDb()) {
    devMemoryDb.wallet.adjustSystemReward(userId, delta);
    return devMemoryDb.wallet.getByUserId(userId);
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول یافت نشد");

  const deduct = Math.min(wallet.systemRewardCoins, amount);
  const updated = await prisma.coinWallet.update({
    where: { userId },
    data: { systemRewardCoins: { decrement: deduct } },
  });

  const balance =
    updated.predictionRewardCoins + updated.systemRewardCoins + updated.purchasedCoins;

  await prisma.coinTransaction.create({
    data: {
      walletId: updated.id,
      coinType: CoinType.SYSTEM_REWARD,
      amount: -deduct,
      balanceAfter: balance,
      type: CoinTransactionType.PREDICTION_REWARD,
      description,
    },
  });

  return updated;
}

export async function addSystemRewardCoins(
  userId: string,
  amount: number,
  type: CoinTransactionType,
  description: string,
) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.addSystemReward(userId, amount);
  }

  const wallet = await prisma.coinWallet.update({
    where: { userId },
    data: { systemRewardCoins: { increment: amount } },
  });

  const balance =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;

  await prisma.coinTransaction.create({
    data: {
      walletId: wallet.id,
      coinType: CoinType.SYSTEM_REWARD,
      amount,
      balanceAfter: balance,
      type,
      description,
    },
  });

  return wallet;
}

/** Grant one or more ticket types to the user's wallet (no spending). */
export async function grantTickets(
  userId: string,
  grants: Array<{ ticketType: TicketWalletField; quantity: number }>,
) {
  const increments = grants
    .map((grant) => ({
      ticketType: grant.ticketType,
      quantity: Math.floor(grant.quantity),
    }))
    .filter((grant) => grant.quantity > 0);

  if (increments.length === 0) return null;

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.addTickets(userId, increments);
  }

  const data: Partial<Record<TicketWalletField, { increment: number }>> = {};
  for (const grant of increments) {
    const prev = data[grant.ticketType]?.increment ?? 0;
    data[grant.ticketType] = { increment: prev + grant.quantity };
  }

  return prisma.coinWallet.update({
    where: { userId },
    data,
  });
}

/** کسر هزینه گردونه از هر سه نوع سکه؛ اگر مجموع صفر شود اعمال نمی‌شود. */
export async function tryDeductWheelSpinCost(
  userId: string,
  amount: number,
  description: string,
): Promise<{ applied: boolean; amount: number }> {
  const cost = Math.floor(amount);
  if (cost <= 0) return { applied: false, amount: 0 };

  if (await shouldUseMemoryDb()) {
    const w = devMemoryDb.wallet.getByUserId(userId);
    if (!w) return { applied: false, amount: 0 };
    const total = w.predictionRewardCoins + w.systemRewardCoins + w.purchasedCoins;
    if (total <= 0 || total - cost <= 0 || total < cost) return { applied: false, amount: 0 };
    devMemoryDb.wallet.deductForPrediction(userId, cost);
    return { applied: true, amount: cost };
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) return { applied: false, amount: 0 };

  const total =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;
  if (total <= 0 || total - cost <= 0 || total < cost) return { applied: false, amount: 0 };

  let remaining = cost;
  let pred = 0;
  let sys = 0;
  let purch = 0;
  const take = (avail: number, bucket: "p" | "s" | "u") => {
    const n = Math.min(avail, remaining);
    remaining -= n;
    if (bucket === "p") purch = n;
    if (bucket === "s") sys = n;
    if (bucket === "u") pred = n;
  };
  take(wallet.purchasedCoins, "p");
  take(wallet.systemRewardCoins, "s");
  take(wallet.predictionRewardCoins, "u");

  const updated = await prisma.coinWallet.update({
    where: { userId },
    data: {
      purchasedCoins: wallet.purchasedCoins - purch,
      systemRewardCoins: wallet.systemRewardCoins - sys,
      predictionRewardCoins: wallet.predictionRewardCoins - pred,
    },
  });

  const balance =
    updated.predictionRewardCoins + updated.systemRewardCoins + updated.purchasedCoins;

  await prisma.coinTransaction.create({
    data: {
      walletId: updated.id,
      coinType: CoinType.SYSTEM_REWARD,
      amount: -cost,
      balanceAfter: balance,
      type: CoinTransactionType.WHEEL_SPIN_COST,
      description,
    },
  });

  return { applied: true, amount: cost };
}

export async function addPurchasedCoins(
  userId: string,
  amount: number,
  description: string,
) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.addPurchased(userId, amount);
  }

  const wallet = await prisma.coinWallet.update({
    where: { userId },
    data: { purchasedCoins: { increment: amount } },
  });

  const balance =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;

  await prisma.coinTransaction.create({
    data: {
      walletId: wallet.id,
      coinType: CoinType.PURCHASED,
      amount,
      balanceAfter: balance,
      type: CoinTransactionType.PURCHASE,
      description,
    },
  });

  return wallet;
}

export async function adjustFootballCredits(userId: string, delta: number) {
  if (delta === 0) return null;

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.adjustFootballCredits(userId, delta);
  }

  if (delta > 0) {
    return prisma.coinWallet.update({
      where: { userId },
      data: { footballCredits: { increment: delta } },
    });
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول یافت نشد");
  const next = Math.max(0, wallet.footballCredits + delta);
  return prisma.coinWallet.update({
    where: { userId },
    data: { footballCredits: next },
  });
}

export async function sellPredictionCoins(_userId: string, _coinAmount: number) {
  throw new Error("فروش سکه غیرفعال است");
}

export async function addXp(userId: string, amount: number) {
  return addXpWithLevelUp(userId, amount, "PREDICTION", "امتیاز پیش‌بینی");
}

export async function addXpWithLevelUp(
  userId: string,
  amount: number,
  type: XpTransactionType = XpTransactionType.PREDICTION,
  description = "امتیاز پیش‌بینی",
): Promise<{ leveledUp: boolean; newLevelNameFa: string | null }> {
  if (await shouldUseMemoryDb()) {
    const profileBefore = devMemoryDb.profile.getByUserId(userId);
    const oldLevelRank = profileBefore?.currentLevel?.rank ?? 0;
    devMemoryDb.profile.addXp(userId, amount);
    const after = devMemoryDb.profile.getByUserId(userId);
    const newLevelRank = after?.currentLevel?.rank ?? oldLevelRank;
    const { refreshUserGlobalRank } = await import("@/server/services/leaderboard-rank-service");
    await refreshUserGlobalRank(userId);
    if (newLevelRank > oldLevelRank && after?.currentLevel?.nameFa) {
      const { publishLevelUpSystemMessage } = await import(
        "@/server/services/chat-system-events"
      );
      void publishLevelUpSystemMessage(userId, after.currentLevel.nameFa);
      return { leveledUp: true, newLevelNameFa: after.currentLevel.nameFa };
    }
    return { leveledUp: false, newLevelNameFa: null };
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: { currentLevel: { select: { id: true, rank: true, nameFa: true } } },
  });
  if (!profile) throw new Error("پروفایل یافت نشد");

  const oldLevelRank = profile.currentLevel?.rank ?? 0;
  const newXp = profile.totalXp + amount;
  const levels = await prisma.level.findMany({ orderBy: { rank: "desc" } });
  const level = levels.find((l) => newXp >= l.xpThreshold) ?? levels.at(-1);

  await prisma.userProfile.update({
    where: { userId },
    data: {
      totalXp: newXp,
      ...(level ? { currentLevelId: level.id } : {}),
    },
  });

  await prisma.xpTransaction.create({
    data: { userId, amount, type, description },
  });

  const { refreshUserGlobalRank } = await import("@/server/services/leaderboard-rank-service");
  await refreshUserGlobalRank(userId);

  if (level && level.rank > oldLevelRank) {
    const { publishLevelUpSystemMessage } = await import("@/server/services/chat-system-events");
    void publishLevelUpSystemMessage(userId, level.nameFa);
    return { leveledUp: true, newLevelNameFa: level.nameFa };
  }

  return { leveledUp: false, newLevelNameFa: null };
}
