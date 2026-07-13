import { CoinTransactionType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import {
  WHEEL_COOLDOWN_MS,
  WHEEL_COST_SPIN_INTERVAL,
  WHEEL_REWARD_OPTIONS,
} from "@/shared/constants/wheel";
import { calculateWheelSpinCost } from "@/shared/lib/wheel-cost";
import {
  coinAmountInTehranDay,
  getLastThreeTehranDayKeys,
  tehranDayBounds,
} from "@/shared/lib/wheel-daily-coins";
import { buildWheelSegmentLayout, findSegmentIndex } from "@/shared/lib/wheel-layout";
import { addSystemRewardCoins, tryDeductWheelSpinCost } from "./wallet-service";

type RewardOption = { coins: number; weight: number };

type WalletSnapshot = {
  systemRewardCoins: number;
  predictionRewardCoins: number;
  purchasedCoins: number;
};

function getFallbackRewardOptions(): RewardOption[] {
  return WHEEL_REWARD_OPTIONS.map((option) => ({
    coins: option.amount,
    weight: option.weight,
  }));
}

function normalizeRewardOptions(options: RewardOption[]) {
  if (options.length === 0) return getFallbackRewardOptions();

  const seen = new Set<number>();
  for (const option of options) {
    if (option.coins <= 0 || option.weight <= 0 || seen.has(option.coins)) {
      return getFallbackRewardOptions();
    }
    seen.add(option.coins);
  }

  return options;
}

function pickWeightedReward(options: RewardOption[]) {
  const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected = options[0];
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) {
      selected = option;
      break;
    }
  }
  return selected;
}

function getTotalCoins(wallet: WalletSnapshot) {
  return wallet.systemRewardCoins + wallet.predictionRewardCoins + wallet.purchasedCoins;
}

async function getWheelCoinsEarnedLast3Days(userId: string) {
  const dayKeys = getLastThreeTehranDayKeys();

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wheel.coinsWonPerDayLast3(userId, dayKeys);
  }

  const since = tehranDayBounds(dayKeys[0]!).start;
  const spins = await prisma.wheelSpin.findMany({
    where: { userId, spunAt: { gte: since } },
    select: { coinsWon: true, spunAt: true },
  });

  return dayKeys.map((dateKey) =>
    spins
      .filter((spin) => coinAmountInTehranDay(spin.spunAt, dateKey))
      .reduce((sum, spin) => sum + spin.coinsWon, 0),
  );
}

async function getTotalSpinCount(userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wheel.spinCount(userId);
  }
  return prisma.wheelSpin.count({
    where: { userId, coinsCostApplied: { gte: 0 } },
  });
}

async function getLastSpin(userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wheel.lastSpin(userId);
  }
  return prisma.wheelSpin.findFirst({
    where: { userId, coinsCostApplied: { gte: 0 } },
    orderBy: { spunAt: "desc" },
  });
}

async function canUserSpin(userId: string) {
  const last = await getLastSpin(userId);
  return !last || Date.now() - last.spunAt.getTime() >= WHEEL_COOLDOWN_MS;
}

async function getRewardOptions(): Promise<RewardOption[]> {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wheel.getRewardOptions();
  }

  const options = await prisma.wheelRewardOption.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  if (options.length === 0) {
    return getFallbackRewardOptions();
  }

  return normalizeRewardOptions(options.map((option) => ({ coins: option.coins, weight: option.weight })));
}

function buildSpinCostInfo(
  totalSpins: number,
  wheelCoinsPerDay: number[],
  wallet: WalletSnapshot,
) {
  const nextSpinNumber = totalSpins + 1;
  const isCostSpin = nextSpinNumber % WHEEL_COST_SPIN_INTERVAL === 0;
  const coinsLast3Days = wheelCoinsPerDay.reduce((sum, amount) => sum + amount, 0);
  const calculatedCost = isCostSpin ? calculateWheelSpinCost(wheelCoinsPerDay) : 0;
  const totalCoins = getTotalCoins(wallet);
  const canApplyCost = calculatedCost > 0 && totalCoins > calculatedCost;

  return {
    nextSpinNumber,
    isCostSpin,
    calculatedCost,
    canApplyCost,
    dailyCoins: wheelCoinsPerDay,
    coinsLast3Days,
    totalCoins,
    systemRewardCoins: wallet.systemRewardCoins,
  };
}

async function getWalletSnapshot(userId: string): Promise<WalletSnapshot> {
  if (await shouldUseMemoryDb()) {
    const wallet = devMemoryDb.wallet.getByUserId(userId);
    return {
      systemRewardCoins: wallet?.systemRewardCoins ?? 0,
      predictionRewardCoins: wallet?.predictionRewardCoins ?? 0,
      purchasedCoins: wallet?.purchasedCoins ?? 0,
    };
  }

  const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
  return {
    systemRewardCoins: wallet?.systemRewardCoins ?? 0,
    predictionRewardCoins: wallet?.predictionRewardCoins ?? 0,
    purchasedCoins: wallet?.purchasedCoins ?? 0,
  };
}

export async function getWheelStatus(userId: string) {
  const dateKey = tehranDateKey(new Date());
  const options = await getRewardOptions();
  const segmentLayout = buildWheelSegmentLayout(
    userId,
    dateKey,
    options.map((option) => option.coins),
  );
  const canSpin = await canUserSpin(userId);
  const last = await getLastSpin(userId);
  const totalSpins = await getTotalSpinCount(userId);
  const wheelCoinsPerDay = await getWheelCoinsEarnedLast3Days(userId);
  const wallet = await getWalletSnapshot(userId);
  const costInfo = buildSpinCostInfo(totalSpins, wheelCoinsPerDay, wallet);

  return {
    canSpin,
    lastSpinAt: last?.spunAt ?? null,
    lastCoinsWon: last?.coinsWon ?? null,
    segmentLayout,
    layoutDateKey: dateKey,
    rewards: options.map((option) => option.coins),
    ...costInfo,
  };
}

export async function spinWheel(userId: string) {
  if (!(await canUserSpin(userId))) {
    throw new Error("هنوز نمی‌توانید بچرخانید. هر ۲۴ ساعت یک بار.");
  }

  const dateKey = tehranDateKey(new Date());
  const options = await getRewardOptions();
  const segmentLayout = buildWheelSegmentLayout(
    userId,
    dateKey,
    options.map((option) => option.coins),
  );
  const selected = pickWeightedReward(options);
  const segmentIndex = findSegmentIndex(segmentLayout, selected.coins);

  const totalSpins = await getTotalSpinCount(userId);
  const wheelCoinsPerDay = await getWheelCoinsEarnedLast3Days(userId);
  const wallet = await getWalletSnapshot(userId);
  const costInfo = buildSpinCostInfo(totalSpins, wheelCoinsPerDay, wallet);

  let coinsCostApplied = 0;
  let costSkipped = false;
  let costSkipReason: string | null = null;

  if (costInfo.isCostSpin && costInfo.calculatedCost > 0) {
    if (costInfo.canApplyCost) {
      const deduction = await tryDeductWheelSpinCost(
        userId,
        costInfo.calculatedCost,
        "هزینه چرخش گردونه (روز سوم)",
      );
      if (deduction.applied) {
        coinsCostApplied = deduction.amount;
      } else {
        costSkipped = true;
        costSkipReason = "موجودی سکه برای کسر هزینه کافی نبود.";
      }
    } else {
      costSkipped = true;
      costSkipReason =
        costInfo.totalCoins <= 0
          ? "موجودی سکه شما صفر است."
          : "با کسر این هزینه مجموع سکه‌های شما صفر می‌شد؛ چرخش بدون هزینه انجام می‌شود.";
    }
  }

  if (await shouldUseMemoryDb()) {
    devMemoryDb.wheel.recordSpin(userId, selected.coins, coinsCostApplied);
    devMemoryDb.wallet.addSystemReward(userId, selected.coins);
  } else {
    await prisma.wheelSpin.create({
      data: {
        userId,
        coinsWon: selected.coins,
        coinsCostApplied,
      },
    });

    await addSystemRewardCoins(
      userId,
      selected.coins,
      CoinTransactionType.WHEEL_REWARD,
      "گردونه شانس",
    );
  }

  return {
    coinsWon: selected.coins,
    segmentIndex: segmentIndex >= 0 ? segmentIndex : 0,
    segmentLayout,
    spinCost: {
      calculated: costInfo.calculatedCost,
      applied: coinsCostApplied,
      skipped: costSkipped,
      skipReason: costSkipReason,
      dailyCoins: costInfo.dailyCoins,
      coinsLast3Days: costInfo.coinsLast3Days,
      totalCoins: costInfo.totalCoins,
      isCostSpin: costInfo.isCostSpin,
      nextSpinNumber: costInfo.nextSpinNumber,
    },
  };
}
