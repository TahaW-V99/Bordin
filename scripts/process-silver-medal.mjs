/**
 * پردازش مدال نقره از فایل اصلی با پس‌زمینه شفاف و روشنایی یکنواخت.
 * Usage: node scripts/process-silver-medal.mjs
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const DIR = path.join(process.cwd(), "public/images/leaderboard");
const SOURCE = path.join(DIR, "medal-silver-source.png");
const OUTPUT = path.join(DIR, "medal-silver.png");

function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function isBackgroundPixel(r, g, b, a) {
  if (a < 16) return true;
  const lum = luminance(r, g, b);
  return lum < 28 && Math.max(r, g, b) - Math.min(r, g, b) < 18;
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

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error("medal-silver-source.png not found");
    process.exit(1);
  }

  const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;

  floodBackgroundToAlpha(data, width, height, channels);

  const tempPath = `${OUTPUT}.tmp.png`;
  await sharp(data, { raw: { width, height, channels } })
    .trim({ threshold: 1 })
    .modulate({ brightness: 1.18, saturation: 1.12 })
    .normalize()
    .gamma(1.04)
    .sharpen({ sigma: 0.6 })
    .resize(120, 120, { fit: "inside" })
    .png({ compressionLevel: 9, quality: 100 })
    .toFile(tempPath);

  fs.renameSync(tempPath, OUTPUT);

  const meta = await sharp(OUTPUT).metadata();
  console.log(`✓ medal-silver.png (${meta.width}x${meta.height}, alpha: ${meta.hasAlpha})`);
}

await main();
