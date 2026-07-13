#!/usr/bin/env node
/**
 * Fix World Cup team competition banner when DB points to a missing file.
 *
 * Liara:
 *   liara shell --app bordin --command "node prisma/repair-world-cup-banner.mjs"
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const CONTENT_TYPES = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  const parsed = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  });
  return new PrismaClient({ adapter });
}

function extractFilename(bannerUrl) {
  if (!bannerUrl) return null;
  const match = String(bannerUrl).match(
    /(?:\/api\/team-competition-banners\/|\/uploads\/team-competition-banners\/)([^/?#]+)/i,
  );
  return match?.[1] ?? null;
}

async function listBannerFiles(dir) {
  try {
    const files = await readdir(dir);
    return files.filter((name) => {
      if (name.startsWith(".")) return false;
      const ext = name.split(".").pop()?.toLowerCase() ?? "";
      return Boolean(CONTENT_TYPES[ext]);
    });
  } catch {
    return [];
  }
}

async function listDbBannerFilenames(prisma) {
  const rows = await prisma.teamCompetitionBannerAsset.findMany({
    select: { filename: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((row) => row.filename);
}

async function bannerFileExists(prisma, filename, diskFiles) {
  if (diskFiles.includes(filename)) return true;
  const row = await prisma.teamCompetitionBannerAsset.findUnique({
    where: { filename },
    select: { filename: true },
  });
  return Boolean(row);
}

async function main() {
  const prisma = createPrisma();
  const uploadDir = path.join(process.cwd(), "public", "uploads", "team-competition-banners");

  try {
    const comp = await prisma.teamCompetition.findFirst({
      where: {
        OR: [
          { titleFa: { contains: "جام جهانی" } },
          { titleFa: { contains: "جام‌جهانی" } },
        ],
      },
      select: { id: true, titleFa: true, bannerUrl: true },
    });

    if (!comp) {
      console.log("World Cup team competition not found.");
      return;
    }

    const diskFiles = await listBannerFiles(uploadDir);
    const dbFiles = await listDbBannerFilenames(prisma);
    const available = [...new Set([...diskFiles, ...dbFiles])];

    if (available.length === 0) {
      console.log("No banner assets found in DB or on disk.");
      console.log("Current bannerUrl:", comp.bannerUrl);
      return;
    }

    const currentFilename = extractFilename(comp.bannerUrl);
    const currentExists =
      currentFilename && (await bannerFileExists(prisma, currentFilename, diskFiles));

    if (currentExists) {
      console.log("Banner already valid:", comp.bannerUrl);
      return;
    }

    const filename = available[0];
    const bannerUrl = `/api/team-competition-banners/${filename}`;

    if (diskFiles.includes(filename)) {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
      const data = await readFile(path.join(uploadDir, filename));
      await prisma.teamCompetitionBannerAsset.upsert({
        where: { filename },
        create: { filename, mimeType: CONTENT_TYPES[ext], data },
        update: { mimeType: CONTENT_TYPES[ext], data },
      });
    }

    await prisma.teamCompetition.update({
      where: { id: comp.id },
      data: { bannerUrl },
    });

    console.log(
      JSON.stringify(
        {
          ok: true,
          competitionId: comp.id,
          titleFa: comp.titleFa,
          previousBannerUrl: comp.bannerUrl,
          bannerUrl,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
