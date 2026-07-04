import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";

function buildShowcaseSlugForUser(userId: string) {
  return `player-${userId.slice(-12)}`;
}

/** Ensures every user has a stable public profile slug for /showcase/[slug]. */
export async function ensureUserShowcaseSlug(userId: string): Promise<string | null> {
  if (await shouldUseMemoryDb()) {
    const profile = devMemoryDb.profile.getRaw(userId);
    if (!profile) return null;
    if (profile.showcaseSlug) return profile.showcaseSlug;
    const slug = buildShowcaseSlugForUser(userId);
    profile.showcaseSlug = slug;
    return slug;
  }

  const existing = await prisma.userProfile.findUnique({
    where: { userId },
    select: { showcaseSlug: true },
  });
  if (!existing) return null;
  if (existing.showcaseSlug) return existing.showcaseSlug;

  const base = buildShowcaseSlugForUser(userId);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt}`;
    try {
      const updated = await prisma.userProfile.update({
        where: { userId },
        data: { showcaseSlug: slug },
        select: { showcaseSlug: true },
      });
      return updated.showcaseSlug;
    } catch {
      // unique collision — retry with suffix
    }
  }
  return null;
}

export function buildShowcaseSlugForNewUser(normalizedPhone: string) {
  return `player-${Date.now().toString(36)}-${normalizedPhone.slice(-4)}`;
}
