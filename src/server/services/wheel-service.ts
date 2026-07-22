import { CoinTransactionType } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import {
  WHEEL_COOLDOWN_MS,
  WHEEL_REWARD_OPTIONS,
  type WheelTicketReward,
} from "@/shared/constants/wheel";
import { buildWheelSegmentLayout, findSegmentIndex } from "@/shared/lib/wheel-layout";
import { addSystemRewardCoins, grantTickets } from "./wallet-service";

type RewardOption = {
  coins: number;
  weight: number;
  tickets: WheelTicketReward[];
};

function getRewardOptionsFromConstants(): RewardOption[] {
  return WHEEL_REWARD_OPTIONS.map((option) => ({
    coins: option.amount,
    weight: option.weight,
    tickets: option.tickets ? [...option.tickets] : [],
  }));
}

function pickWeightedReward(options: RewardOption[]) {
  const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = Math.random() * totalWeight;
  let selected = options[0]!;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) {
      selected = option;
      break;
    }
  }
  return selected;
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

/**
 * Multi-asset wheel rewards come from constants so ticket grants stay in sync
 * with the segment UI. Weights (probabilities) are unchanged.
 */
function getRewardOptions(): RewardOption[] {
  return getRewardOptionsFromConstants();
}

export async function getWheelStatus(userId: string) {
  const dateKey = tehranDateKey(new Date());
  const options = getRewardOptions();
  const segmentLayout = buildWheelSegmentLayout(
    userId,
    dateKey,
    options.map((option) => option.coins),
  );
  const canSpin = await canUserSpin(userId);
  const last = await getLastSpin(userId);
  const rewardByCoins = new Map(options.map((option) => [option.coins, option]));
  const segments = segmentLayout.map((coins) => {
    const option = rewardByCoins.get(coins);
    return {
      coins,
      tickets: option?.tickets ?? [],
    };
  });

  return {
    canSpin,
    lastSpinAt: last?.spunAt ?? null,
    lastCoinsWon: last?.coinsWon ?? null,
    segmentLayout,
    segments,
    layoutDateKey: dateKey,
    rewards: options.map((option) => option.coins),
    // Spin is free — cost fields remain zero for backward-compatible clients.
    nextSpinNumber: 1,
    isCostSpin: false,
    calculatedCost: 0,
    canApplyCost: false,
    dailyCoins: [0, 0, 0],
    coinsLast3Days: 0,
    totalCoins: 0,
    systemRewardCoins: 0,
  };
}

export async function spinWheel(userId: string) {
  if (!(await canUserSpin(userId))) {
    throw new Error("هنوز نمی‌توانید بچرخانید. هر ۲۴ ساعت یک بار.");
  }

  const dateKey = tehranDateKey(new Date());
  const options = getRewardOptions();
  const segmentLayout = buildWheelSegmentLayout(
    userId,
    dateKey,
    options.map((option) => option.coins),
  );
  const selected = pickWeightedReward(options);
  const segmentIndex = findSegmentIndex(segmentLayout, selected.coins);
  const ticketsWon = selected.tickets;

  if (await shouldUseMemoryDb()) {
    devMemoryDb.wheel.recordSpin(userId, selected.coins, 0);
    devMemoryDb.wallet.addSystemReward(userId, selected.coins);
    if (ticketsWon.length > 0) {
      devMemoryDb.wallet.addTickets(userId, ticketsWon);
    }
  } else {
    await prisma.wheelSpin.create({
      data: {
        userId,
        coinsWon: selected.coins,
        coinsCostApplied: 0,
      },
    });

    await addSystemRewardCoins(
      userId,
      selected.coins,
      CoinTransactionType.WHEEL_REWARD,
      "گردونه شانس",
    );

    if (ticketsWon.length > 0) {
      await grantTickets(userId, ticketsWon);
    }
  }

  return {
    coinsWon: selected.coins,
    ticketsWon,
    segmentIndex: segmentIndex >= 0 ? segmentIndex : 0,
    segmentLayout,
    spinCost: {
      calculated: 0,
      applied: 0,
      skipped: false,
      skipReason: null,
      dailyCoins: [0, 0, 0],
      coinsLast3Days: 0,
      totalCoins: 0,
      isCostSpin: false,
      nextSpinNumber: 1,
    },
  };
}
