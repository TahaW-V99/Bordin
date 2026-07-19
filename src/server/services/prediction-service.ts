import {
  CoinTransactionType,
  CoinType,
  CompetitionType,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { devMemoryDb } from "@/server/dev-memory-db";
import { shouldUseMemoryDb } from "@/server/db";
import { userNeedsDisplayName } from "@/shared/lib/kandakator-utils";
import { getPredictionDeadlineInstant, effectivePredictionCutoffMinutes } from "@/shared/lib/dates";
import { resolveDailyPredictionEntryFee } from "@/server/services/team-competition-prediction-fee-service";
import { blockNonCaptainKnockoutDailySubmit } from "@/server/services/team-competition-knockout-prediction-service";
import { DisplayNameRequiredError } from "@/server/services/prediction-errors";
import { parseFixtureExternalId } from "@/server/services/fixture-api";

export { DisplayNameRequiredError } from "@/server/services/prediction-errors";

export async function assertCanPredict(userId: string) {
  if (await shouldUseMemoryDb()) {
    const user = devMemoryDb.user.findById(userId);
    const profile = devMemoryDb.profile.getByUserId(userId);
    if (!user || userNeedsDisplayName(user.phone, profile?.displayName)) {
      throw new DisplayNameRequiredError();
    }
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true },
  });
  if (!user || userNeedsDisplayName(user.phone, user.profile?.displayName)) {
    throw new DisplayNameRequiredError();
  }
}

export async function submitDailyPrediction(
  userId: string,
  matchId: string,
  kandakatorId: string,
  homePrediction: number,
  awayPrediction: number,
) {
  await assertCanPredict(userId);

  if (await shouldUseMemoryDb()) {
    const kandakator = devMemoryDb.kandakator.getById(kandakatorId);
    const km = kandakator?.matches.find((m) => m.matchId === matchId);
    if (!km) throw new Error("مسابقه در کنداکتور یافت نشد");

    const cutoffMs = getPredictionDeadlineInstant(
      km.match.kickoffAt,
      effectivePredictionCutoffMinutes(km.predictionCutoffMinutes),
    );
    if (Date.now() >= cutoffMs) throw new Error("مهلت پیش‌بینی به پایان رسیده است");

    if (devMemoryDb.predictions.findExistingDaily(userId, matchId)) {
      throw new Error("شما قبلاً برای این مسابقه پیش‌بینی ثبت کرده‌اید");
    }

    const entryFee = await resolveDailyPredictionEntryFee(userId, {
      id: matchId,
      kickoffAt: km.match.kickoffAt,
      leagueName: km.match.leagueName,
      externalId: parseFixtureExternalId(km.matchId) ? km.matchId : null,
    });
    const wallet = devMemoryDb.wallet.getByUserId(userId);
    const total =
      (wallet?.predictionRewardCoins ?? 0) +
      (wallet?.systemRewardCoins ?? 0) +
      (wallet?.purchasedCoins ?? 0);
    if (total < entryFee) {
      throw new Error("موجودی سکه کافی نیست");
    }

    if (entryFee > 0) {
      devMemoryDb.wallet.deductForPrediction(userId, entryFee);
    }
    const prediction = devMemoryDb.predictions.create({
      userId,
      matchId,
      competitionType: "DAILY",
      competitionRefId: kandakatorId,
      homePrediction,
      awayPrediction,
      entryFeeCoins: entryFee,
    });
    devMemoryDb.profile.incrementPredictions(userId);
    return prediction;
  }

  const kandakatorMatch = await prisma.kandakatorMatch.findFirst({
    where: { kandakatorId, matchId },
    include: { match: true, kandakator: true },
  });

  if (!kandakatorMatch) {
    throw new Error("مسابقه در کنداکتور یافت نشد");
  }

  const knockoutCtx = await blockNonCaptainKnockoutDailySubmit(userId, matchId, kandakatorId);
  if (knockoutCtx) {
    throw new Error("در مرحله حذفی، پیش‌بینی تیمی فقط توسط کاپیتان ثبت می‌شود");
  }

  const cutoffMs = getPredictionDeadlineInstant(
    kandakatorMatch.match.kickoffAt,
    effectivePredictionCutoffMinutes(kandakatorMatch.predictionCutoffMinutes),
  );

  if (Date.now() >= cutoffMs) {
    throw new Error("مهلت پیش‌بینی به پایان رسیده است");
  }

  const existing = await prisma.prediction.findFirst({
    where: {
      userId,
      matchId,
      competitionType: CompetitionType.DAILY,
    },
  });

  if (existing) {
    throw new Error("شما قبلاً برای این مسابقه پیش‌بینی ثبت کرده‌اید");
  }

  const entryFee = await resolveDailyPredictionEntryFee(userId, {
    id: kandakatorMatch.match.id,
    kickoffAt: kandakatorMatch.match.kickoffAt,
    leagueName: kandakatorMatch.match.leagueName,
    externalId: kandakatorMatch.match.externalId,
  });

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  if (!wallet) throw new Error("کیف پول یافت نشد");

  const totalCoins =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;

  if (totalCoins < entryFee) {
    throw new Error("موجودی سکه کافی نیست");
  }

  return prisma.$transaction(async (tx) => {
    // Free (standard) matches: no coins are deducted and no entry transaction is recorded.
    if (entryFee > 0) {
      let remaining = entryFee;
      let predDeduct = 0;
      let sysDeduct = 0;
      let purchDeduct = 0;

      const spendFrom = (
        available: number,
        type: "pred" | "sys" | "purch",
      ) => {
        const take = Math.min(available, remaining);
        remaining -= take;
        if (type === "pred") predDeduct += take;
        if (type === "sys") sysDeduct += take;
        if (type === "purch") purchDeduct += take;
      };

      spendFrom(wallet.purchasedCoins, "purch");
      spendFrom(wallet.systemRewardCoins, "sys");
      spendFrom(wallet.predictionRewardCoins, "pred");

      const updatedWallet = await tx.coinWallet.update({
        where: { userId },
        data: {
          purchasedCoins: wallet.purchasedCoins - purchDeduct,
          systemRewardCoins: wallet.systemRewardCoins - sysDeduct,
          predictionRewardCoins: wallet.predictionRewardCoins - predDeduct,
        },
      });

      const newBalance =
        updatedWallet.predictionRewardCoins +
        updatedWallet.systemRewardCoins +
        updatedWallet.purchasedCoins;

      await tx.coinTransaction.create({
        data: {
          walletId: updatedWallet.id,
          coinType: CoinType.PURCHASED,
          amount: -entryFee,
          balanceAfter: newBalance,
          type: CoinTransactionType.PREDICTION_ENTRY,
          referenceId: matchId,
          description: "ورودی پیش‌بینی روزانه",
        },
      });
    }

    const prediction = await tx.prediction.create({
      data: {
        userId,
        matchId,
        competitionType: CompetitionType.DAILY,
        competitionRefId: kandakatorId,
        homePrediction,
        awayPrediction,
        entryFeeCoins: entryFee,
      },
    });

    await tx.userProfile.update({
      where: { userId },
      data: { totalPredictions: { increment: 1 } },
    });

    return prediction;
  });
}
