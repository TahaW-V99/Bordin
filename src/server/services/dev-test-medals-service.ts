import { normalizePhone } from "@/shared/lib/phone";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { prisma } from "@/shared/lib/prisma";
import { MedalCategory, MedalTier } from "@prisma/client";
import { MEDAL_CATALOG_BY_SLUG } from "@/shared/constants/medals";

import { DEV_TEST_GRANTS } from "@/server/dev-test-medals-config";

function isDevGrantEnabled() {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.SMS_MOCK_MODE === "true" ||
    process.env.DEV_GRANT_TEST_MEDALS === "true"
  );
}

const TIER_MAP: Record<string, MedalTier> = {
  BRONZE: MedalTier.BRONZE,
  SILVER: MedalTier.SILVER,
  GOLD: MedalTier.GOLD,
  DARK_PURPLE: MedalTier.DARK_PURPLE,
  SPECIAL: MedalTier.SPECIAL,
};

const CATEGORY_MAP: Record<string, MedalCategory> = {
  MISSION: MedalCategory.MISSION,
  CUP: MedalCategory.CUP,
  TOURNAMENT: MedalCategory.TOURNAMENT,
  TEAM: MedalCategory.TEAM,
};

async function ensureMedalExistsInPrisma(slug: string) {
  const existing = await prisma.medal.findUnique({ where: { slug } });
  if (existing) return existing;

  const entry = MEDAL_CATALOG_BY_SLUG[slug];
  if (!entry) throw new Error(`Unknown medal slug: ${slug}`);

  return prisma.medal.create({
    data: {
      slug,
      titleFa: entry.titleFa,
      description: entry.titleFa,
      iconUrl: `/images/medals/${slug}.png`,
      tier: TIER_MAP[entry.tier] ?? MedalTier.SPECIAL,
      category: CATEGORY_MAP[entry.category] ?? MedalCategory.MISSION,
      isActive: true,
    },
  });
}

async function grantMedalToUser(userId: string, slug: string) {
  if (await shouldUseMemoryDb()) {
    devMemoryDb.medals.award(userId, slug, "");
    return;
  }

  try {
    const medal = await ensureMedalExistsInPrisma(slug);

    const exists = await prisma.userMedal.findFirst({
      where: { userId, medalId: medal.id },
    });
    if (exists) {
      if (exists.earnedReason) {
        await prisma.userMedal.update({
          where: { id: exists.id },
          data: { earnedReason: null },
        });
      }
      return;
    }

    await prisma.userMedal.create({
      data: {
        userId,
        medalId: medal.id,
        earnedReason: null,
      },
    });
  } catch {
    devMemoryDb.medals.award(userId, slug, "");
  }
}

/** در محیط توسعه، مدال‌های تست را به کاربران مشخص‌شده می‌دهد. */
export async function ensureDevTestMedalsForUser(userId: string, phone: string) {
  if (!isDevGrantEnabled()) return;

  const normalized = normalizePhone(phone);
  const grants = DEV_TEST_GRANTS.filter((g) => normalizePhone(g.phone) === normalized);
  if (grants.length === 0) return;

  for (const grant of grants) {
    await grantMedalToUser(userId, grant.slug);
  }
}
