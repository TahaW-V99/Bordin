/**
 * Re-score all finished-match predictions against current official scores.
 * Fixes early settlement with partial/wrong scores.
 *
 * Run locally (with production DATABASE_URL):
 *   npx tsx scripts/rescore-all-predictions.ts
 *
 * Run on Liara shell:
 *   node prisma/rescore-predictions-liara.mjs
 */
import { rescoreAllFinishedMatchPredictions } from "@/server/services/settlement-service";

async function main() {
  const result = await rescoreAllFinishedMatchPredictions();
  console.log(JSON.stringify({ ok: true, ...result }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
