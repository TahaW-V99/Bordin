import { CoinTransactionType, CoinType, XpTransactionType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { devMemoryDb } from "@/server/dev-memory-db";
import { shouldUseMemoryDb } from "@/server/db";

export async function deductCoins(userId: string, amount: number, description: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.deductForPrediction(userId, amount);
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول یافت نشد");

  const total =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;
  if (total < amount) throw new Error("موجودی سکه کافی نیست");

  let remaining = amount;
  let pred = 0;
  let sys = 0;
  let purch = 0;
  const take = (avail: number, type: "p" | "s" | "u") => {
    const n = Math.min(avail, remaining);
    remaining -= n;
    if (type === "p") purch = n;
    if (type === "s") sys = n;
    if (type === "u") pred = n;
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
      coinType: CoinType.PURCHASED,
      amount: -amount,
      balanceAfter: balance,
      type: CoinTransactionType.PREDICTION_ENTRY,
      description,
    },
  });

  return updated;
}

export async function deductCoinsWithType(
  userId: string,
  amount: number,
  type: CoinTransactionType,
  description: string,
) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.deductForPrediction(userId, amount);
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول یافت نشد");

  const total =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;
  if (total < amount) throw new Error("موجودی سکه کافی نیست");

  let remaining = amount;
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
      amount: -amount,
      balanceAfter: balance,
      type,
      description,
    },
  });

  return updated;
}

export async function addPredictionRewardCoins(
  userId: string,
  amount: number,
  type: CoinTransactionType,
  description: string,
) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.addPredictionReward(userId, amount);
  }

  const wallet = await prisma.coinWallet.update({
    where: { userId },
    data: { predictionRewardCoins: { increment: amount } },
  });

  const balance =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;

  await prisma.coinTransaction.create({
    data: {
      walletId: wallet.id,
      coinType: CoinType.PREDICTION_REWARD,
      amount,
      balanceAfter: balance,
      type,
      description,
    },
  });

  return wallet;
}

/** Positive or negative adjustment after prediction re-scoring. */
export async function adjustPredictionRewardCoins(
  userId: string,
  delta: number,
  description: string,
) {
  if (delta === 0) return null;
  if (delta > 0) {
    return addPredictionRewardCoins(
      userId,
      delta,
      CoinTransactionType.PREDICTION_REWARD,
      description,
    );
  }

  const amount = Math.abs(delta);
  if (await shouldUseMemoryDb()) {
    devMemoryDb.wallet.adjustPredictionReward(userId, delta);
    return devMemoryDb.wallet.getByUserId(userId);
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول یافت نشد");

  const deduct = Math.min(wallet.predictionRewardCoins, amount);
  const updated = await prisma.coinWallet.update({
    where: { userId },
    data: { predictionRewardCoins: { decrement: deduct } },
  });

  const balance =
    updated.predictionRewardCoins + updated.systemRewardCoins + updated.purchasedCoins;

  await prisma.coinTransaction.create({
    data: {
      walletId: updated.id,
      coinType: CoinType.PREDICTION_REWARD,
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

export async function sellPredictionCoins(userId: string, coinAmount: number) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.sellPredictionCoins(userId, coinAmount);
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet || wallet.predictionRewardCoins < coinAmount) {
    throw new Error("موجودی سکه قابل فروش کافی نیست");
  }

  const tomanValue = Math.floor(coinAmount * 45);
  const updated = await prisma.coinWallet.update({
    where: { userId },
    data: {
      predictionRewardCoins: { decrement: coinAmount },
      cashBalanceToman: { increment: tomanValue },
    },
  });

  await prisma.coinTransaction.create({
    data: {
      walletId: updated.id,
      coinType: CoinType.PREDICTION_REWARD,
      amount: -coinAmount,
      balanceAfter:
        updated.predictionRewardCoins +
        updated.systemRewardCoins +
        updated.purchasedCoins,
      type: CoinTransactionType.SELL,
      description: `فروش ${coinAmount} سکه`,
    },
  });

  return { wallet: updated, tomanValue };
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
