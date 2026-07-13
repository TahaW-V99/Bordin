export type WheelRewardOption = {
  amount: number;
  weight: number;
};

/** مقادیر و وزن‌های گردونه شانس — قابل تنظیم از seed / ادمین */
export const WHEEL_REWARD_OPTIONS: WheelRewardOption[] = [
  { amount: 300, weight: 35 },
  { amount: 350, weight: 25 },
  { amount: 450, weight: 15 },
  { amount: 500, weight: 10 },
  { amount: 600, weight: 7 },
  { amount: 700, weight: 4 },
  { amount: 800, weight: 2 },
  { amount: 1000, weight: 1 },
  { amount: 1200, weight: 0.6 },
  { amount: 1500, weight: 0.4 },
];

export const WHEEL_SEGMENT_COUNT = WHEEL_REWARD_OPTIONS.length;
export const WHEEL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const WHEEL_COST_SPIN_INTERVAL = 3;
