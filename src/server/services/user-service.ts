import { prisma } from "@/shared/lib/prisma";
import { serializeKickoffAt } from "@/shared/lib/dates";
import { devMemoryDb } from "@/server/dev-memory-db";
import { shouldUseMemoryDb } from "@/server/db";
import { ensureMemoryUser } from "@/server/ensure-memory-user";

export async function getCurrentUser(userId: string) {
  if (await shouldUseMemoryDb()) {
    const user = (await ensureMemoryUser(userId)) ?? devMemoryDb.user.findById(userId);
    if (!user) return null;
    const resolvedUserId = user.id;
    const profile = devMemoryDb.profile.getByUserId(resolvedUserId);
    const wallet = devMemoryDb.wallet.getByUserId(resolvedUserId);
    return {
      id: user.id,
      phone: user.phone,
      username: user.username,
      onboardingComplete: user.onboardingComplete,
      profile: profile
        ? {
            displayName: profile.displayName,
            currentLevel: profile.currentLevel,
          }
        : null,
      wallet: wallet
        ? {
            predictionRewardCoins: wallet.predictionRewardCoins,
            systemRewardCoins: wallet.systemRewardCoins,
            purchasedCoins: wallet.purchasedCoins,
            footballCredits: wallet.footballCredits ?? 0,
            legendsCupTickets: wallet.legendsCupTickets ?? 0,
            normalCupTickets: wallet.normalCupTickets ?? 0,
            tournamentTickets: wallet.tournamentTickets ?? 0,
            teamCompetitionTickets: wallet.teamCompetitionTickets ?? 0,
          }
        : null,
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: { include: { currentLevel: true } },
      wallet: true,
    },
  });

  if (!user) return null;

  return {
    id: user.id,
    phone: user.phone,
    username: user.username,
    onboardingComplete: user.onboardingComplete,
    profile: user.profile,
    wallet: user.wallet,
  };
}

export async function getTodayKandakator(userId: string) {
  if (await shouldUseMemoryDb()) {
    const kandakator = devMemoryDb.kandakator.getToday();
    if (!kandakator?.isPublished) return null;

    const userPredictions = devMemoryDb.predictions.listForKandakator(
      userId,
      kandakator.id,
    );
    const predictionMap = new Map(userPredictions.map((p) => [p.matchId, p]));

    return {
      id: kandakator.id,
      title: kandakator.title,
      date: kandakator.date,
      entryFeeCoins: kandakator.entryFeeCoins,
      matches: kandakator.matches.map((km) => ({
        id: km.id,
        matchId: km.matchId,
        sortOrder: km.sortOrder,
        predictionCutoffMinutes: km.predictionCutoffMinutes,
        match: {
          ...km.match,
          kickoffAt: serializeKickoffAt(km.match.kickoffAt),
        },
        prediction: predictionMap.get(km.matchId) ?? null,
      })),
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const kandakator = await prisma.dailyKandakator.findFirst({
    where: { date: today, isPublished: true },
    include: {
      matches: {
        orderBy: { sortOrder: "asc" },
        include: { match: true },
      },
    },
  });

  if (!kandakator) return null;

  const userPredictions = await prisma.prediction.findMany({
    where: {
      userId,
      competitionRefId: kandakator.id,
      competitionType: "DAILY",
    },
    select: {
      matchId: true,
      homePrediction: true,
      awayPrediction: true,
      accuracyPercent: true,
      coinsEarned: true,
      xpEarned: true,
    },
  });

  const predictionMap = new Map(userPredictions.map((p) => [p.matchId, p]));

  return {
    id: kandakator.id,
    title: kandakator.title,
    date: kandakator.date,
    entryFeeCoins: kandakator.entryFeeCoins,
    matches: kandakator.matches.map((km) => ({
      id: km.id,
      matchId: km.matchId,
      sortOrder: km.sortOrder,
      predictionCutoffMinutes: km.predictionCutoffMinutes,
      match: {
        ...km.match,
        kickoffAt: serializeKickoffAt(km.match.kickoffAt),
      },
      prediction: predictionMap.get(km.matchId) ?? null,
    })),
  };
}
