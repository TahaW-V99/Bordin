#!/usr/bin/env node
/**
 * Backfill banner binaries from disk into MySQL (survives Liara redeploys).
 *
 * Prerequisites:
 * 1. Deploy the banner DB changes to production first.
 * 2. Run: npm run db:push:production  (or db:patch:production)
 *
 * Liara:
 *   liara shell --app bordin --command "node prisma/backfill-team-competition-banners.mjs"
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

async function ensureBannerTable(prisma) {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS team_competition_banner_assets (
      filename VARCHAR(191) NOT NULL,
      mimeType VARCHAR(191) NOT NULL,
      data LONGBLOB NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      PRIMARY KEY (filename)
    )
  `);
}

async function main() {
  const prisma = createPrisma();

  try {
    await ensureBannerTable(prisma);

    const dir = path.join(process.cwd(), "public", "uploads", "team-competition-banners");
    let files;
    try {
      files = await readdir(dir);
    } catch {
      console.log("No banner upload directory found:", dir);
      return;
    }

    const candidates = files.filter((filename) => {
      if (filename.startsWith(".")) return false;
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      return Boolean(CONTENT_TYPES[ext]);
    });

    if (candidates.length === 0) {
      console.log("No banner image files on disk to backfill.");
      console.log("Re-upload banners from admin panel — new uploads persist in DB.");
      return;
    }

    let saved = 0;
    for (const filename of candidates) {
      const ext = filename.split(".").pop()?.toLowerCase() ?? "";
      const data = await readFile(path.join(dir, filename));
      await prisma.teamCompetitionBannerAsset.upsert({
        where: { filename },
        create: {
          filename,
          mimeType: CONTENT_TYPES[ext],
          data,
        },
        update: {
          mimeType: CONTENT_TYPES[ext],
          data,
        },
      });
      saved += 1;
      console.log("saved:", filename);
    }

    console.log(`Done. ${saved} banner(s) stored in database.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
