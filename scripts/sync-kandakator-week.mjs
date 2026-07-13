/**
 * Sync Tehran week kandakator from Fixture API into MySQL.
 * Run on Liara (staging/production) where DATABASE_URL is reachable:
 *   liara shell -a bordintest -c "node scripts/sync-kandakator-week.mjs"
 *
 * Local (if DATABASE_URL points to staging via tunnel):
 *   node scripts/sync-kandakator-week.mjs
 */
import { spawnSync } from "node:child_process";

const result = spawnSync(
  "npx",
  ["tsx", "scripts/sync-kandakator-week.ts"],
  { stdio: "inherit", shell: true },
);

process.exit(result.status ?? 1);
