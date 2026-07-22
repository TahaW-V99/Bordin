import type { TicketWalletField } from "@/shared/constants/tickets";

/** One ticket grant attached to a wheel segment reward. */
export type WheelTicketReward = {
  ticketType: TicketWalletField;
  quantity: number;
};

/**
 * Flexible segment reward: coins today, tickets (and future asset types) as extras.
 * Probabilities are controlled only by `weight` — do not change weights casually.
 */
export type WheelRewardOption = {
  amount: number;
  weight: number;
  tickets?: WheelTicketReward[];
};

/** مقادیر و وزن‌های گردونه شانس — وزن‌ها ثابت؛ فقط محتوای پاداش تغییر می‌کند */
export const WHEEL_REWARD_OPTIONS: WheelRewardOption[] = [
  { amount: 100, weight: 35 },
  {
    amount: 150,
    weight: 25,
    tickets: [{ ticketType: "tournamentTickets", quantity: 1 }],
  },
  { amount: 200, weight: 15 },
  { amount: 300, weight: 10 },
  {
    amount: 350,
    weight: 7,
    tickets: [{ ticketType: "normalCupTickets", quantity: 1 }],
  },
  { amount: 400, weight: 4 },
  {
    amount: 500,
    weight: 2,
    tickets: [{ ticketType: "legendsCupTickets", quantity: 1 }],
  },
  { amount: 600, weight: 1 },
  { amount: 700, weight: 0.6 },
  {
    amount: 1000,
    weight: 0.4,
    tickets: [
      { ticketType: "tournamentTickets", quantity: 1 },
      { ticketType: "legendsCupTickets", quantity: 2 },
      { ticketType: "teamCompetitionTickets", quantity: 1 },
    ],
  },
];

export const WHEEL_SEGMENT_COUNT = WHEEL_REWARD_OPTIONS.length;
export const WHEEL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const WHEEL_COST_SPIN_INTERVAL = 3;

export function getWheelRewardByCoins(coins: number): WheelRewardOption | undefined {
  return WHEEL_REWARD_OPTIONS.find((option) => option.amount === coins);
}
