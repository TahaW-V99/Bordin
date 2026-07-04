import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import sharp from "sharp";

const DIR = path.join(process.cwd(), "public/images/leaderboard");

const OUTPUTS = {
  gold: "medal-gold.png",
  silver: "medal-silver.png",
  bronze: "medal-bronze.png",
};

const SOURCE_PATTERNS = {
  gold: [/^medal-gold(?!.*source)/i],
  silver: [/^medal-silver-source/i, /^medal-silver(?!\.png$)/i],
  bronze: [/^medal-bronze(?!.*source)/i],
};

function findSource(kind) {
  const patterns = SOURCE_PATTERNS[kind];
  const outputName = OUTPUTS[kind];
  const candidates = fs
    .readdirSync(DIR)
    .filter((name) => patterns.some((pattern) => pattern.test(name)))
    .filter((name) => name !== outputName && !name.endsWith("-staging.png"))
    .map((name) => ({
      name,
      fullPath: path.join(DIR, name),
      size: fs.statSync(path.join(DIR, name)).size,
    }))
    .sort((a, b) => {
      if (a.name.includes("-source")) return -1;
      if (b.name.includes("-source")) return 1;
      return b.size - a.size;
    });

  return candidates[0]?.fullPath ?? null;
}

async function processGoldOrBronze(inputPath, outputPath) {
  const tempPath = `${outputPath}.tmp.png`;
  await sharp(inputPath)
    .resize(120, 120, { fit: "inside", withoutEnlargement: true })
    .png({ compressionLevel: 9 })
    .toFile(tempPath);
  fs.renameSync(tempPath, outputPath);
  const meta = await sharp(outputPath).metadata();
  console.log(`✓ ${path.basename(outputPath)} (${meta.width}x${meta.height})`);
}

async function main() {
  const only = process.argv[2];
  const kinds = only ? [only] : ["gold", "silver", "bronze"];

  for (const kind of kinds) {
    if (kind === "silver") {
      const silverScript = path.join(process.cwd(), "scripts/process-silver-medal.mjs");
      if (fs.existsSync(path.join(DIR, "medal-silver-source.png"))) {
        spawnSync("node", [silverScript], { stdio: "inherit", shell: true });
        continue;
      }
    }

    const source = findSource(kind);
    if (!source) continue;
    await processGoldOrBronze(source, path.join(DIR, OUTPUTS[kind]));
  }
}

await main();
