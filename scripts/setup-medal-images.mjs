/**
 * Copies uploaded medal assets into public/images/medals/{slug}.png
 * UUID order matches verified artwork (see remap-medal-images.mjs history).
 * Run: node scripts/setup-medal-images.mjs
 * Force overwrite: FORCE=1 node scripts/setup-medal-images.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const force = process.env.FORCE === "1";

const ASSETS_DIR =
  process.env.MEDAL_ASSETS_DIR ??
  "C:\\Users\\98902\\.cursor\\projects\\c-Users-98902-OneDrive-Desktop-BordinApp\\assets";

const OUT_DIR = join(root, "public", "images", "medals");

const SLUGS = [
  "sheykarchee-bronze",
  "sheykarchee-silver",
  "sheykarchee-gold",
  "sheykarchee-dark",
  "vafadar-bronze",
  "vafadar-silver",
  "vafadar-gold",
  "vafadar-dark",
  "cup-normal-60",
  "cup-normal-70",
  "cup-normal-80",
  "cup-normal-90",
  "cup-normal-100",
  "cup-legend-50",
  "cup-legend-60",
  "cup-legend-70",
  "cup-legend-80",
  "cup-legend-90",
  "cup-legend-100",
  "tournament-fateh",
  "tournament-pirooz",
  "tournament-pishro",
  "team-qahraman",
  "team-raqib",
];

/** Verified UUID per slug (correct artwork) */
const UUID_SUFFIXES = [
  "3f878724-62f2-4351-b279-1c18b64227b2",
  "d58e793a-e0ec-4c3d-b1c3-a71cad1abc74",
  "13696e67-b8d4-4c87-b6b8-56b3f0f2d8bb",
  "bd2bbe7e-2322-4a30-a313-7e2a27da51fd",
  "8314337d-a07a-4408-947d-89f6d9232f20",
  "32ff3006-7a65-4db2-9d57-208b92bc3452",
  "8fc1dbcc-e79d-4dfb-89a4-da9ffcb685c3",
  "92d8c612-11ae-4bdf-99f1-5b302994aaa9",
  "94107ed5-5433-4e76-a1d2-d3970f30382e",
  "f303bf1e-cb3e-454e-a986-251ff230253d",
  "d2f6c006-ca7e-47dc-adf1-f3812a7815b7",
  "9239fef7-0a65-4f6d-95bc-c1ba1f123974",
  "d14418d6-b24c-46a5-a17a-487b9b69aff1",
  "746e0ece-3b30-4d16-997d-77b1071287bb",
  "811a1abd-c28c-43d2-bb27-007a6d082549",
  "7e267c57-3251-47c8-812f-eb20ac52b259",
  "cc29eee1-f412-4efa-8246-2771ab1fb08b",
  "ed4d7f47-3f0e-4fcb-9819-0ae76b5a2a4a",
  "7eb71e5f-a470-415b-9455-2a2ce8845901",
  "a80b2b40-847f-4479-83a0-4a29a9e73c55",
  "1a6758c0-f0d2-4395-97fb-c868aa47110c",
  "ce2cb051-8ea0-4659-88f9-4c24a3c00f91",
  "7e4b37c2-2064-4d94-96f4-e48d2c03f9c1",
  "81ac0fb6-df39-419e-9fa6-47ce7426e63b",
];

function findSourceFile(uuid) {
  if (!existsSync(ASSETS_DIR)) return null;
  const files = readdirSync(ASSETS_DIR);
  return files.find((f) => f.includes(uuid) && f.endsWith(".png")) ?? null;
}

mkdirSync(OUT_DIR, { recursive: true });

let copied = 0;
for (let i = 0; i < SLUGS.length; i++) {
  const slug = SLUGS[i];
  const out = join(OUT_DIR, `${slug}.png`);
  if (existsSync(out) && !force) {
    copied++;
    continue;
  }
  const sourceName = findSourceFile(UUID_SUFFIXES[i]);
  if (!sourceName) {
    console.warn(`Missing source for ${slug}`);
    continue;
  }
  copyFileSync(join(ASSETS_DIR, sourceName), out);
  copied++;
  console.log(`✓ ${slug}.png`);
}

console.log(`Done: ${copied}/${SLUGS.length} medal images in ${OUT_DIR}`);
