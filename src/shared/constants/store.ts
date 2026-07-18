/** Client bundle flag — mirrors isStoreSellEnabled() at build time. */
export const STORE_SELL_UI_ENABLED =
  process.env.NEXT_PUBLIC_BORDIN_ENV !== "production" &&
  (process.env.NEXT_PUBLIC_STORE_SELL_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_STORE_SELL_ENABLED === "1");

export const BUY_COIN_PACKAGES = [
  { id: "pkg-600", nameFa: "یک مشت سکه ۶۰۰تایی", coinAmount: 600, priceToman: 24_000, sortOrder: 0 },
  { id: "pkg-1200", nameFa: "یک کیسه سکه ۱۲۰۰تایی", coinAmount: 1200, priceToman: 43_000, sortOrder: 1 },
  { id: "pkg-3000", nameFa: "یک جعبه سکه ۳۰۰۰تایی", coinAmount: 3000, priceToman: 102_000, sortOrder: 2 },
  { id: "pkg-6000", nameFa: "یک فرغون سکه ۶۰۰۰تایی", coinAmount: 6000, priceToman: 192_000, sortOrder: 3 },
  { id: "pkg-12000", nameFa: "یک وانت سکه ۱۲۰۰۰تایی", coinAmount: 12000, priceToman: 360_000, sortOrder: 4 },
] as const;

export const SELL_COIN_PACKAGES = [
  { id: "sell-3000", coinAmount: 3000, priceToman: 204_000 },
  { id: "sell-6000", coinAmount: 6000, priceToman: 384_000 },
  { id: "sell-12000", coinAmount: 12000, priceToman: 720_000 },
] as const;

export type BuyCoinPackage = (typeof BUY_COIN_PACKAGES)[number];
export type SellCoinPackage = (typeof SELL_COIN_PACKAGES)[number];
