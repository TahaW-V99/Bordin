export type WheelRewardOption = {
  amount: number;
  weight: number;
};

/** مقادیر و وزن‌های گردونه شانس — قابل تنظیم از seed / ادمین */
export const WHEEL_REWARD_OPTIONS: WheelRewardOption[] = [
  { amount: 300, weight: 40 },
  { amount: 350, weight: 30 },
  { amount: 450, weight: 15 },
  { amount: 500, weight: 7 },
  { amount: 600, weight: 3 },
  { amount: 700, weight: 2 },
  { amount: 800, weight: 1.5 },
  { amount: 1000, weight: 1 },
  { amount: 1200, weight: 0.4 },
  { amount: 1500, weight: 0.1 },
];

export const WHEEL_SEGMENT_COUNT = WHEEL_REWARD_OPTIONS.length;
export const WHEEL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const WHEEL_COST_SPIN_INTERVAL = 3;
