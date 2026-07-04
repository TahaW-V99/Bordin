/**
 * Removes black PNG backgrounds from honor medal images (transparent alpha).
 * Run: node scripts/process-honor-medals.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const MEDAL_DIR = path.join(process.cwd(), "public", "images", "medals");

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isBackgroundPixel(r, g, b, a) {
  if (a < 16) return true;
  const lum = luminance(r, g, b);
  return lum < 32 && Math.max(r, g, b) - Math.min(r, g, b) < 22;
}

function floodBackgroundToAlpha(data, width, height, channels) {
  const mask = new Uint8Array(width * height);
  const queue = [];

  for (let x = 0; x < width; x += 1) {
    queue.push([x, 0], [x, height - 1]);
  }
  for (let y = 0; y < height; y += 1) {
    queue.push([0, y], [width - 1, y]);
  }

  while (queue.length > 0) {
    const [x, y] = queue.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const idx = y * width + x;
    if (mask[idx]) continue;

    const i = idx * channels;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3] ?? 255;
    if (!isBackgroundPixel(r, g, b, a)) continue;

    mask[idx] = 1;
    data[i + 3] = 0;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

async function processFile(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  floodBackgroundToAlpha(data, width, height, channels);

  const tempPath = `${filePath}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(tempPath);

  fs.renameSync(tempPath, filePath);
}

async function main() {
  const files = fs.readdirSync(MEDAL_DIR).filter((f) => f.endsWith(".png"));
  for (const file of files) {
    const filePath = path.join(MEDAL_DIR, file);
    await processFile(filePath);
    console.log(`✓ ${file}`);
  }
  console.log(`Done: ${files.length} medal images processed.`);
}

await main();
