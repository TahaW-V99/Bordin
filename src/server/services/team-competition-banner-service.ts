import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";

const memoryBanners = new Map<string, { mimeType: string; data: Buffer }>();

function toStoredBytes(data: Buffer): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(data);
}

export async function saveTeamCompetitionBannerAsset(
  filename: string,
  mimeType: string,
  data: Buffer,
) {
  if (await shouldUseMemoryDb()) {
    memoryBanners.set(filename, { mimeType, data });
    return;
  }

  const bytes = toStoredBytes(data);
  await prisma.teamCompetitionBannerAsset.upsert({
    where: { filename },
    create: { filename, mimeType, data: bytes },
    update: { mimeType, data: bytes },
  });
}

export async function loadTeamCompetitionBannerAsset(filename: string) {
  if (await shouldUseMemoryDb()) {
    return memoryBanners.get(filename) ?? null;
  }

  const row = await prisma.teamCompetitionBannerAsset.findUnique({
    where: { filename },
    select: { mimeType: true, data: true },
  });
  if (!row) return null;
  return { mimeType: row.mimeType, data: Buffer.from(row.data) };
}
