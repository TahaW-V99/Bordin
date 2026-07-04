/**
 * Liara shell entrypoint — re-score predictions with current match scores.
 *   liara shell --app bordin --command "node prisma/rescore-predictions-liara.mjs"
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["tsx", "scripts/rescore-all-predictions.ts"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

process.exit(result.status ?? 1);
