import { MEDAL_CATALOG } from "@/shared/constants/medals";

export type MissionProgressSource = "invite_count" | "total_predictions" | "perfect_predictions";

export type MissionTierDefinition = {
  tierKey: string;
  tierLabelFa: string;
  threshold: number;
  coins: number;
  xp: number;
  medalSlug: string | null;
};

export type MissionDefinition = {
  slug: string;
  titleFa: string;
  descriptionFa: string;
  tooltipFa: string;
  progressSource: MissionProgressSource;
  sortOrder: number;
  /** When true, reward is granted automatically at completion (no claim button). */
  autoClaimOnComplete: boolean;
  /** Future-ready: mission slug that must be fully completed first. */
  prerequisiteMissionSlug?: string;
  tiers: MissionTierDefinition[];
};

function medalTitle(slug: string | null) {
  if (!slug) return null;
  return MEDAL_CATALOG.find((m) => m.slug === slug)?.titleFa ?? null;
}

export const MISSION_DEFINITIONS: MissionDefinition[] = [
  {
    slug: "davat",
    titleFa: "دعوت از ۱۰ دوست",
    descriptionFa: "پیش‌بینی فوتبال بدون رفقا مزه نمیده! به بُردین دعوتشون کن و همینجا بهشون ثابت کن چقدر کارت درسته.",
    tooltipFa:
      "با دعوت موفق دوستان (ثبت‌نام موفق از طریق کد معرف)، نوار پیشرفت از ۱ به سمت ۱۰ نفر پر می‌شود. با تکمیل ۱۰ دعوت، پاداش به‌صورت خودکار به شما تعلق می‌گیرد.",
    progressSource: "invite_count",
    sortOrder: 1,
    autoClaimOnComplete: true,
    tiers: [
      {
        tierKey: "complete",
        tierLabelFa: "تکمیل",
        threshold: 10,
        coins: 50,
        xp: 100,
        medalSlug: null,
      },
    ],
  },
  {
    slug: "vafadar",
    titleFa: "کسب مدال وفادار",
    descriptionFa:
      "به همه ثابت کن که پایه ثابت پیش‌بینی فوتبال هستی و این کار رو تخصصی بلدی! کافیه همیشه پیش‌بینی ثبت کنی و به تعدادی پیش‌بینی برسی.",
    tooltipFa:
      "مالک تیم‌ها دنبال جذب ستاره‌ها برای تیم‌شون هستن! با مدال‌هایی که کسب می‌کنی، به یک ستاره تبدیل می‌شی. پس از رسیدن به هر مرحله، دکمه دریافت پاداش را بزن.",
    progressSource: "total_predictions",
    sortOrder: 2,
    autoClaimOnComplete: false,
    tiers: [
      {
        tierKey: "bronze",
        tierLabelFa: "برنزی",
        threshold: 110,
        coins: 2550,
        xp: 7000,
        medalSlug: "vafadar-bronze",
      },
      {
        tierKey: "silver",
        tierLabelFa: "نقره‌ای",
        threshold: 210,
        coins: 4250,
        xp: 11000,
        medalSlug: "vafadar-silver",
      },
      {
        tierKey: "gold",
        tierLabelFa: "طلایی",
        threshold: 320,
        coins: 6800,
        xp: 16000,
        medalSlug: "vafadar-gold",
      },
      {
        tierKey: "dark",
        tierLabelFa: "دارک پرپل",
        threshold: 500,
        coins: 10200,
        xp: 21000,
        medalSlug: "vafadar-dark",
      },
    ],
  },
  {
    slug: "sheykarchee",
    titleFa: "کسب مدال شکارچی",
    descriptionFa:
      "اگر بتونی تعدادی پیش‌بینی ۱۰۰ درصد صحیح کسب کنی، یک شکارچی در بُردین هستی. به همه ثابت کن دقت پیش‌بینیت حرف نداره!",
    tooltipFa:
      "مالک تیم‌ها دنبال جذب ستاره‌ها برای تیم‌شون هستن! با مدال‌هایی که کسب می‌کنی، به یک ستاره تبدیل می‌شی. پس از رسیدن به هر مرحله، دکمه دریافت پاداش را بزن.",
    progressSource: "perfect_predictions",
    sortOrder: 3,
    autoClaimOnComplete: false,
    tiers: [
      {
        tierKey: "bronze",
        tierLabelFa: "برنزی",
        threshold: 18,
        coins: 5000,
        xp: 9000,
        medalSlug: "sheykarchee-bronze",
      },
      {
        tierKey: "silver",
        tierLabelFa: "نقره‌ای",
        threshold: 25,
        coins: 8000,
        xp: 14000,
        medalSlug: "sheykarchee-silver",
      },
      {
        tierKey: "gold",
        tierLabelFa: "طلایی",
        threshold: 35,
        coins: 12000,
        xp: 18000,
        medalSlug: "sheykarchee-gold",
      },
      {
        tierKey: "dark",
        tierLabelFa: "دارک پرپل",
        threshold: 55,
        coins: 18000,
        xp: 28000,
        medalSlug: "sheykarchee-dark",
      },
    ],
  },
];

export function getMissionDefinition(slug: string) {
  return MISSION_DEFINITIONS.find((m) => m.slug === slug) ?? null;
}

export function enrichMissionTier(tier: MissionTierDefinition) {
  return {
    ...tier,
    medalTitleFa: medalTitle(tier.medalSlug),
  };
}
