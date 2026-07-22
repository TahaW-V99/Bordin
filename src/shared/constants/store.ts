import type { TicketWalletField } from "@/shared/constants/tickets";

/** Client bundle flag — mirrors isStoreSellEnabled() at build time. */
export const STORE_SELL_UI_ENABLED =
  process.env.NEXT_PUBLIC_BORDIN_ENV !== "production" &&
  (process.env.NEXT_PUBLIC_STORE_SELL_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_STORE_SELL_ENABLED === "1");

export type StoreProductCategory = "bundle" | "coins" | "tickets" | "energy";

export type StoreAssetGrant =
  | { kind: "purchasedCoins"; amount: number }
  | { kind: "ticket"; ticketType: TicketWalletField; quantity: number }
  | { kind: "energy"; percent: number };

export type StoreBadgeTone = "blue" | "green" | "gold";

export type StoreProduct = {
  id: string;
  category: StoreProductCategory;
  nameFa: string;
  /** Final payable price in Toman */
  priceToman: number;
  /** Pre-discount sum for bundles (strikethrough) */
  originalPriceToman?: number;
  discountPercent?: number;
  image: string;
  imageWidth: number;
  imageHeight: number;
  grants: StoreAssetGrant[];
  badge?: { text: string; tone: StoreBadgeTone };
  sortOrder: number;
  /** Convenience for coin-only products / history */
  coinAmount: number;
};

export const SELL_COIN_PACKAGES = [
  { id: "sell-3000", coinAmount: 3000, priceToman: 204_000 },
  { id: "sell-6000", coinAmount: 6000, priceToman: 384_000 },
  { id: "sell-12000", coinAmount: 12000, priceToman: 720_000 },
] as const;

export type SellCoinPackage = (typeof SELL_COIN_PACKAGES)[number];

/** Unit prices used for auto-calculating bundle original prices. */
export const STORE_UNIT_PRICES = {
  coins: {
    600: 24_000,
    1200: 42_000,
    3000: 99_000,
    6000: 189_000,
    12000: 349_000,
  },
  tickets: {
    normalCupTickets: 25_000,
    legendsCupTickets: 34_000,
    teamCompetitionTickets: 82_000,
    tournamentTickets: 159_000,
  } satisfies Record<TicketWalletField, number>,
  energy: {
    25: 9_900,
    50: 17_900,
    100: 29_900,
  },
} as const;

function sumGrantPrices(grants: StoreAssetGrant[]): number {
  let total = 0;
  for (const grant of grants) {
    if (grant.kind === "purchasedCoins") {
      const unit = STORE_UNIT_PRICES.coins[grant.amount as keyof typeof STORE_UNIT_PRICES.coins];
      if (unit == null) {
        throw new Error(`قیمت واحد برای ${grant.amount} سکه تعریف نشده است`);
      }
      total += unit;
      continue;
    }
    if (grant.kind === "ticket") {
      total += STORE_UNIT_PRICES.tickets[grant.ticketType] * grant.quantity;
      continue;
    }
    const unit = STORE_UNIT_PRICES.energy[grant.percent as keyof typeof STORE_UNIT_PRICES.energy];
    if (unit == null) {
      throw new Error(`قیمت واحد برای انرژی ${grant.percent}٪ تعریف نشده است`);
    }
    total += unit;
  }
  return total;
}

function buildBundle(input: {
  id: string;
  nameFa: string;
  image: string;
  discountPercent: number;
  grants: StoreAssetGrant[];
  badge: { text: string; tone: StoreBadgeTone };
  sortOrder: number;
}): StoreProduct {
  const originalPriceToman = sumGrantPrices(input.grants);
  const priceToman = Math.round(originalPriceToman * (1 - input.discountPercent / 100));
  const coinAmount = input.grants.reduce(
    (sum, grant) => (grant.kind === "purchasedCoins" ? sum + grant.amount : sum),
    0,
  );
  return {
    id: input.id,
    category: "bundle",
    nameFa: input.nameFa,
    priceToman,
    originalPriceToman,
    discountPercent: input.discountPercent,
    image: input.image,
    imageWidth: 328,
    imageHeight: 115,
    grants: input.grants,
    badge: input.badge,
    sortOrder: input.sortOrder,
    coinAmount,
  };
}

export const STORE_COIN_PRODUCTS: StoreProduct[] = [
  {
    id: "pkg-600",
    category: "coins",
    nameFa: "یک مشت سکه ۶۰۰تایی",
    priceToman: STORE_UNIT_PRICES.coins[600],
    image: "/images/store/buy-12000.png",
    imageWidth: 72,
    imageHeight: 133,
    grants: [{ kind: "purchasedCoins", amount: 600 }],
    sortOrder: 0,
    coinAmount: 600,
  },
  {
    id: "pkg-1200",
    category: "coins",
    nameFa: "یک کیسه سکه ۱۲۰۰تایی",
    priceToman: STORE_UNIT_PRICES.coins[1200],
    image: "/images/store/buy-1200.png",
    imageWidth: 72,
    imageHeight: 133,
    grants: [{ kind: "purchasedCoins", amount: 1200 }],
    sortOrder: 1,
    coinAmount: 1200,
  },
  {
    id: "pkg-3000",
    category: "coins",
    nameFa: "یک جعبه سکه ۳۰۰۰تایی",
    priceToman: STORE_UNIT_PRICES.coins[3000],
    image: "/images/store/buy-600.png",
    imageWidth: 72,
    imageHeight: 133,
    grants: [{ kind: "purchasedCoins", amount: 3000 }],
    sortOrder: 2,
    coinAmount: 3000,
  },
  {
    id: "pkg-6000",
    category: "coins",
    nameFa: "یک فرغون سکه ۶۰۰۰تایی",
    priceToman: STORE_UNIT_PRICES.coins[6000],
    image: "/images/store/buy-6000.png",
    imageWidth: 72,
    imageHeight: 133,
    grants: [{ kind: "purchasedCoins", amount: 6000 }],
    sortOrder: 3,
    coinAmount: 6000,
  },
  {
    id: "pkg-12000",
    category: "coins",
    nameFa: "یک وانت سکه ۱۲۰۰۰تایی",
    priceToman: STORE_UNIT_PRICES.coins[12000],
    image: "/images/store/buy-3000.png",
    imageWidth: 72,
    imageHeight: 133,
    grants: [{ kind: "purchasedCoins", amount: 12000 }],
    sortOrder: 4,
    coinAmount: 12000,
  },
];

export const STORE_TICKET_PRODUCTS: StoreProduct[] = [
  {
    id: "ticket-normal-cup",
    category: "tickets",
    nameFa: "بلیط کاپ (نرمال مود)",
    priceToman: STORE_UNIT_PRICES.tickets.normalCupTickets,
    image: "/images/tickets/ticket-cup-normal.png",
    imageWidth: 230,
    imageHeight: 100,
    grants: [{ kind: "ticket", ticketType: "normalCupTickets", quantity: 1 }],
    sortOrder: 0,
    coinAmount: 0,
  },
  {
    id: "ticket-legends-cup",
    category: "tickets",
    nameFa: "بلیط کاپ (لجندز مود)",
    priceToman: STORE_UNIT_PRICES.tickets.legendsCupTickets,
    image: "/images/tickets/ticket-cup-legends.png",
    imageWidth: 230,
    imageHeight: 100,
    grants: [{ kind: "ticket", ticketType: "legendsCupTickets", quantity: 1 }],
    sortOrder: 1,
    coinAmount: 0,
  },
  {
    id: "ticket-team-competition",
    category: "tickets",
    nameFa: "بلیط رقابت تیمی",
    priceToman: STORE_UNIT_PRICES.tickets.teamCompetitionTickets,
    image: "/images/tickets/ticket-team-competition.png",
    imageWidth: 230,
    imageHeight: 100,
    grants: [{ kind: "ticket", ticketType: "teamCompetitionTickets", quantity: 1 }],
    sortOrder: 2,
    coinAmount: 0,
  },
  {
    id: "ticket-tournament",
    category: "tickets",
    nameFa: "بلیط تورنومنت",
    priceToman: STORE_UNIT_PRICES.tickets.tournamentTickets,
    image: "/images/tickets/ticket-tournament.png",
    imageWidth: 230,
    imageHeight: 100,
    grants: [{ kind: "ticket", ticketType: "tournamentTickets", quantity: 1 }],
    sortOrder: 3,
    coinAmount: 0,
  },
];

export const STORE_ENERGY_PRODUCTS: StoreProduct[] = [
  {
    id: "energy-25",
    category: "energy",
    nameFa: "۲۵٪ انرژی فوتبالی",
    priceToman: STORE_UNIT_PRICES.energy[25],
    image: "/images/store/energy-football.png",
    imageWidth: 108,
    imageHeight: 108,
    grants: [{ kind: "energy", percent: 25 }],
    sortOrder: 0,
    coinAmount: 0,
  },
  {
    id: "energy-50",
    category: "energy",
    nameFa: "۵۰٪ انرژی فوتبالی",
    priceToman: STORE_UNIT_PRICES.energy[50],
    image: "/images/store/energy-football.png",
    imageWidth: 108,
    imageHeight: 108,
    grants: [{ kind: "energy", percent: 50 }],
    sortOrder: 1,
    coinAmount: 0,
  },
  {
    id: "energy-100",
    category: "energy",
    nameFa: "۱۰۰٪ انرژی فوتبالی",
    priceToman: STORE_UNIT_PRICES.energy[100],
    image: "/images/store/energy-football.png",
    imageWidth: 108,
    imageHeight: 108,
    grants: [{ kind: "energy", percent: 100 }],
    sortOrder: 2,
    coinAmount: 0,
  },
];

export const STORE_BUNDLE_PRODUCTS: StoreProduct[] = [
  buildBundle({
    id: "bundle-soot-aghaz",
    nameFa: "سوت آغاز",
    image: "/images/store/bundle-soot-aghaz.png",
    discountPercent: 22,
    sortOrder: 0,
    badge: { text: "پیشنهاد شروع", tone: "blue" },
    grants: [
      { kind: "purchasedCoins", amount: 1200 },
      { kind: "ticket", ticketType: "normalCupTickets", quantity: 1 },
      { kind: "energy", percent: 25 },
    ],
  }),
  buildBundle({
    id: "bundle-tarkib-barande",
    nameFa: "ترکیب برنده",
    image: "/images/store/bundle-tarkib-barande.png",
    discountPercent: 20,
    sortOrder: 1,
    badge: { text: "به‌صرفه‌ترین", tone: "green" },
    grants: [
      { kind: "purchasedCoins", amount: 3000 },
      { kind: "ticket", ticketType: "normalCupTickets", quantity: 1 },
      { kind: "ticket", ticketType: "legendsCupTickets", quantity: 1 },
      { kind: "energy", percent: 50 },
    ],
  }),
  buildBundle({
    id: "bundle-ghahreman-lig",
    nameFa: "قهرمان لیگ",
    image: "/images/store/bundle-ghahreman-lig.png",
    discountPercent: 20,
    sortOrder: 2,
    badge: { text: "محبوب‌ترین", tone: "gold" },
    grants: [
      { kind: "purchasedCoins", amount: 6000 },
      { kind: "ticket", ticketType: "tournamentTickets", quantity: 1 },
      { kind: "ticket", ticketType: "teamCompetitionTickets", quantity: 1 },
      { kind: "ticket", ticketType: "legendsCupTickets", quantity: 2 },
      { kind: "energy", percent: 100 },
    ],
  }),
];

export const STORE_PRODUCTS: StoreProduct[] = [
  ...STORE_BUNDLE_PRODUCTS,
  ...STORE_COIN_PRODUCTS,
  ...STORE_TICKET_PRODUCTS,
  ...STORE_ENERGY_PRODUCTS,
];

/** @deprecated Prefer STORE_COIN_PRODUCTS / STORE_PRODUCTS — kept for callers expecting the old shape. */
export const BUY_COIN_PACKAGES = STORE_COIN_PRODUCTS.map((product) => ({
  id: product.id,
  nameFa: product.nameFa,
  coinAmount: product.coinAmount,
  priceToman: product.priceToman,
  sortOrder: product.sortOrder,
}));

export type BuyCoinPackage = (typeof BUY_COIN_PACKAGES)[number];

export function findStoreProduct(packageId: string): StoreProduct | undefined {
  return STORE_PRODUCTS.find((product) => product.id === packageId);
}

export function getStoreProductsByCategory(category: StoreProductCategory): StoreProduct[] {
  return STORE_PRODUCTS.filter((product) => product.category === category).sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function summarizeStoreGrants(grants: StoreAssetGrant[]): string[] {
  const lines: string[] = [];
  for (const grant of grants) {
    if (grant.kind === "purchasedCoins") {
      lines.push(`${grant.amount} سکه خریداری‌شده`);
      continue;
    }
    if (grant.kind === "ticket") {
      lines.push(`${grant.quantity} بلیط`);
      continue;
    }
    lines.push(`${grant.percent}٪ انرژی`);
  }
  return lines;
}
