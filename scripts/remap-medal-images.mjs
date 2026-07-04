/**
 * Restores correct medal image filenames from source assets.
 * Prefer: FORCE=1 npm run setup:medal-images
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const setup = join(__dirname, "setup-medal-images.mjs");

const result = spawnSync(process.execPath, [setup], {
  stdio: "inherit",
  env: { ...process.env, FORCE: "1" },
});

process.exit(result.status ?? 1);
