export const REWARD_TABLES: Record<
  string,
  Array<{ accuracyPercent: number; coins: number; xp: number; medalSlug?: string }>
> = {
  "daily-prediction": [
    { accuracyPercent: 0, coins: 20, xp: 24 },
    { accuracyPercent: 10, coins: 40, xp: 48 },
    { accuracyPercent: 20, coins: 70, xp: 84 },
    { accuracyPercent: 30, coins: 110, xp: 132 },
    { accuracyPercent: 40, coins: 140, xp: 168 },
    { accuracyPercent: 50, coins: 220, xp: 264 },
    { accuracyPercent: 60, coins: 290, xp: 348 },
    { accuracyPercent: 70, coins: 370, xp: 444 },
    { accuracyPercent: 80, coins: 800, xp: 552 },
    { accuracyPercent: 90, coins: 900, xp: 672 },
    { accuracyPercent: 100, coins: 1200, xp: 900 },
  ],
  "cup-normal": [
    { accuracyPercent: 0, coins: 24, xp: 140 },
    { accuracyPercent: 10, coins: 48, xp: 160 },
    { accuracyPercent: 20, coins: 84, xp: 190 },
    { accuracyPercent: 30, coins: 132, xp: 230 },
    { accuracyPercent: 40, coins: 168, xp: 260 },
    { accuracyPercent: 50, coins: 364, xp: 340 },
    { accuracyPercent: 60, coins: 410, xp: 548, medalSlug: "cup-normal-60" },
    { accuracyPercent: 70, coins: 800, xp: 644, medalSlug: "cup-normal-70" },
    { accuracyPercent: 80, coins: 920, xp: 752, medalSlug: "cup-normal-80" },
    { accuracyPercent: 90, coins: 1020, xp: 872, medalSlug: "cup-normal-90" },
    { accuracyPercent: 100, coins: 1600, xp: 1800, medalSlug: "cup-normal-100" },
  ],
  "cup-legend": [
    { accuracyPercent: 0, coins: 24, xp: 640 },
    { accuracyPercent: 10, coins: 48, xp: 660 },
    { accuracyPercent: 20, coins: 84, xp: 690 },
    { accuracyPercent: 30, coins: 132, xp: 730 },
    { accuracyPercent: 40, coins: 168, xp: 760 },
    { accuracyPercent: 50, coins: 840, xp: 564, medalSlug: "cup-legend-50" },
    { accuracyPercent: 60, coins: 1100, xp: 748, medalSlug: "cup-legend-60" },
    { accuracyPercent: 70, coins: 1300, xp: 844, medalSlug: "cup-legend-70" },
    { accuracyPercent: 80, coins: 1420, xp: 952, medalSlug: "cup-legend-80" },
    { accuracyPercent: 90, coins: 1520, xp: 1072, medalSlug: "cup-legend-90" },
    { accuracyPercent: 100, coins: 2400, xp: 2700, medalSlug: "cup-legend-100" },
  ],
  "tournament-fath": [
    { accuracyPercent: 0, coins: 48, xp: 20 },
    { accuracyPercent: 10, coins: 96, xp: 40 },
    { accuracyPercent: 20, coins: 168, xp: 70 },
    { accuracyPercent: 30, coins: 264, xp: 110 },
    { accuracyPercent: 40, coins: 336, xp: 140 },
    { accuracyPercent: 50, coins: 528, xp: 220 },
    { accuracyPercent: 60, coins: 696, xp: 290 },
    { accuracyPercent: 70, coins: 888, xp: 370 },
    { accuracyPercent: 80, coins: 1104, xp: 800 },
    { accuracyPercent: 90, coins: 1344, xp: 900 },
    { accuracyPercent: 100, coins: 1800, xp: 1200 },
  ],
};

export const LEVELS = [
  { rank: 1, nameFa: "تماشاگر", xpThreshold: 50 },
  { rank: 2, nameFa: "هوادار", xpThreshold: 3050 },
  { rank: 3, nameFa: "نیمکت نشین", xpThreshold: 6550 },
  { rank: 4, nameFa: "یارکمکی", xpThreshold: 13550 },
  { rank: 5, nameFa: "بازیخوان", xpThreshold: 28550 },
  { rank: 6, nameFa: "آقای گل", xpThreshold: 53550 },
  { rank: 7, nameFa: "کاپتان بُردین", xpThreshold: 88550 },
  { rank: 8, nameFa: "کمک مربی", xpThreshold: 128550 },
  { rank: 9, nameFa: "مربی", xpThreshold: 183550 },
  { rank: 10, nameFa: "اسطوره", xpThreshold: 248550 },
  { rank: 11, nameFa: "مرجع", xpThreshold: 328550 },
];

export const WHEEL_REWARDS = [300, 350, 450, 500, 600, 700, 800, 1000, 1200, 1500];

export const COIN_PACKAGES = [
  { id: "pkg-600", nameFa: "یک مشت سکه ۶۰۰تایی", coinAmount: 600, priceToman: 24000 },
  { id: "pkg-1200", nameFa: "یک کیسه سکه ۱۲۰۰تایی", coinAmount: 1200, priceToman: 42000 },
  { id: "pkg-3000", nameFa: "یک جعبه سکه ۳۰۰۰تایی", coinAmount: 3000, priceToman: 99000 },
  { id: "pkg-6000", nameFa: "یک فرغون سکه ۶۰۰۰تایی", coinAmount: 6000, priceToman: 189000 },
  { id: "pkg-12000", nameFa: "یک وانت سکه ۱۲۰۰۰تایی", coinAmount: 12000, priceToman: 349000 },
];

import { bucketAccuracy } from "@/shared/lib/prediction-accuracy";

/** Football Credit granted only for exact 100% prediction accuracy */
export const FOOTBALL_CREDIT_PERFECT_REWARD = 100;

export function getRewardFromTable(slug: string, accuracyPercent: number) {
  const bucket = bucketAccuracy(accuracyPercent);
  const tiers = REWARD_TABLES[slug] ?? [];
  const tier = tiers.find((t) => t.accuracyPercent === bucket) ?? tiers[0];
  return tier ? { ...tier, bucket } : { coins: 0, xp: 0, bucket, medalSlug: undefined };
}
