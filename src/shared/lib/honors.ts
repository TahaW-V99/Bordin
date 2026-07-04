import {
  MEDAL_CATALOG,
  medalImageUrl,
  type MedalCatalogEntry,
} from "@/shared/constants/medals";

export type EarnedMedalInput = {
  earnedAt?: string | Date | null;
  earnedReason?: string | null;
  medal?: {
    slug?: string | null;
    titleFa?: string | null;
    tier?: string | null;
    category?: string | null;
  } | null;
};

export type HonorItem = {
  slug: string;
  titleFa: string;
  subtitleFa: string;
  tier: string;
  category: string;
  imageUrl: string;
  glowColor: string;
  glowIntensity: number;
  hasParticles: boolean;
  earned: boolean;
  earnedAt: string | null;
  earnedReason: string | null;
};

function medalSubtitle(entry: MedalCatalogEntry): string {
  if (entry.category === "MISSION") {
    const labels: Record<string, string> = {
      BRONZE: "برنز",
      SILVER: "نقره",
      GOLD: "طلایی",
      DARK_PURPLE: "افسانه",
    };
    return labels[entry.tier] ?? "";
  }
  if (entry.category === "CUP") {
    return entry.slug.startsWith("cup-legend") ? "کاپ: لجندز مود" : "کاپ: نورمال مود";
  }
  if (entry.category === "TOURNAMENT") return "تورنمنت";
  if (entry.category === "TEAM") return "تیمی";
  return "";
}

function sanitizeEarnedReason(reason?: string | null) {
  const value = reason?.trim();
  if (!value) return null;
  if (value.startsWith("انتقال مدال از سیستم قدیمی")) return null;
  return value;
}

function catalogEntryToHonor(
  entry: MedalCatalogEntry,
  earned?: EarnedMedalInput,
): HonorItem {
  const isEarned = Boolean(earned);
  return {
    slug: entry.slug,
    titleFa: entry.titleFa,
    subtitleFa: medalSubtitle(entry),
    tier: entry.tier,
    category: entry.category,
    imageUrl: medalImageUrl(entry.slug),
    glowColor: entry.glowColor,
    glowIntensity: entry.glowIntensity,
    hasParticles: entry.hasParticles,
    earned: isEarned,
    earnedAt: earned?.earnedAt
      ? new Date(earned.earnedAt).toISOString()
      : null,
    earnedReason: sanitizeEarnedReason(earned?.earnedReason),
  };
}

/** Merges full medal catalog with user's earned medals for honors display */
export function buildHonorsList(earnedMedals: EarnedMedalInput[]): HonorItem[] {
  const earnedBySlug = new Map<string, EarnedMedalInput>();
  for (const item of earnedMedals) {
    const slug = item.medal?.slug;
    if (slug) earnedBySlug.set(slug, item);
  }

  return MEDAL_CATALOG.map((entry) =>
    catalogEntryToHonor(entry, earnedBySlug.get(entry.slug)),
  );
}
