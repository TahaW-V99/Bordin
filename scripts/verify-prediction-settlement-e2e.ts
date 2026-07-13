/**
 * End-to-end verification: prediction lifecycle without frontend polling.
 * Run: npx tsx scripts/verify-prediction-settlement-e2e.ts
 */
process.env.DEV_MEMORY_DB = "true";
process.env.SMS_MOCK_MODE = "true";
process.env.NODE_ENV = "test";

import { devMemoryDb } from "@/server/dev-memory-db";
import { submitDailyPrediction } from "@/server/services/prediction-service";
import {
  applyOfficialMatchResult,
  getUserPredictionResultsLast7Days,
} from "@/server/services/settlement-service";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import { isPredictionSettled } from "@/shared/types/prediction-results";

const USER_ID = `e2e-settlement-${Date.now()}`;
const PHONE = "09129998877";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

async function main() {
  devMemoryDb.user.ensureFromSession(USER_ID, PHONE);
  devMemoryDb.profile.updateDisplayName(USER_ID, "E2E Tester", 0);

  const todayKey = tehranDateKey(new Date());
  const kandakator = devMemoryDb.kandakator.getByDate(todayKey);
  assert(!!kandakator && kandakator.matches.length > 0, "kandakator with matches exists");

  const km = kandakator!.matches.find(
    (row) => !devMemoryDb.predictions.findExistingDaily(USER_ID, row.matchId),
  ) ?? kandakator!.matches[0];
  km.match.kickoffAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  // Step 1: Create prediction
  const prediction = await submitDailyPrediction(
    USER_ID,
    km.matchId,
    kandakator!.id,
    2,
    1,
  );
  assert(prediction.scoredAt === null, "1. prediction created and unscored");

  // Scenario A: scores applied via sync event (applyOfficialMatchResult)
  const settleResult = await applyOfficialMatchResult(km.matchId, 3, 1);
  assert(settleResult.settled >= 1, "2–3. official score stored and settlement triggered");

  const match = devMemoryDb.kandakator.findMatchById(km.matchId);
  assert(match?.homeScore === 3 && match?.awayScore === 1, "3. score persisted in memory store");

  const storedPrediction = devMemoryDb.predictions
    .listSubmittedSince(USER_ID, new Date(0))
    .find((p) => p.id === prediction.id);
  assert(storedPrediction?.scoredAt !== null, "4. prediction scoredAt is set");
  assert(storedPrediction?.accuracyPercent !== null, "4. prediction accuracy computed");

  let pending = await getUserPredictionResultsLast7Days(USER_ID, "pending");
  let settled = await getUserPredictionResultsLast7Days(USER_ID, "settled");

  assert(!pending.some((item) => item.id === prediction.id), "5. absent from pending tab");
  assert(settled.some((item) => item.id === prediction.id), "6. present in settled tab");

  const settledItem = settled.find((item) => item.id === prediction.id)!;
  assert(isPredictionSettled(settledItem), "7. first request returns settled state");
  assert(settledItem.match.homeScore === 3 && settledItem.match.awayScore === 1, "7. includes score");

  // Scenario B: scores in store but settlement missed (stale-read bug regression)
  const km2 =
    kandakator!.matches.find(
      (row) => row.matchId !== km.matchId && !devMemoryDb.predictions.findExistingDaily(USER_ID, row.matchId),
    ) ?? kandakator!.matches[1];
  assert(!!km2, "second match available for stale-settlement test");
  km2.match.kickoffAt = new Date(Date.now() + 2 * 60 * 60 * 1000);

  const prediction2 = await submitDailyPrediction(USER_ID, km2.matchId, kandakator!.id, 1, 0);
  const match2 = devMemoryDb.kandakator.findMatchById(km2.matchId)!;
  match2.homeScore = 2;
  match2.awayScore = 0;
  match2.status = "FINISHED";

  pending = await getUserPredictionResultsLast7Days(USER_ID, "pending");
  settled = await getUserPredictionResultsLast7Days(USER_ID, "settled");
  assert(!pending.some((item) => item.id === prediction2.id), "B5. stale scores settled on first API read");
  assert(settled.some((item) => item.id === prediction2.id), "B6. appears in settled after first read");

  // Scenario C: API hydrate must not orphan seed match IDs
  let km3: (typeof kandakator)["matches"][number] | null = null;
  let mergeDateKey = todayKey;
  for (const day of devMemoryDb.kandakator.listAll()) {
    const row = day.matches.find(
      (m) => !devMemoryDb.predictions.findExistingDaily(USER_ID, m.matchId),
    );
    if (row) {
      km3 = row;
      mergeDateKey = tehranDateKey(day.date);
      break;
    }
  }
  assert(!!km3, "unused match available for merge-id test");
  km3!.match.kickoffAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const seedMatchId = km3!.matchId;

  const prediction3 = await submitDailyPrediction(
    USER_ID,
    seedMatchId,
    km3!.kandakatorId,
    1,
    1,
  );
  devMemoryDb.kandakator.mergeDayFromApi(mergeDateKey, [
    {
      matchId: "fixture-orphan-test",
      homeTeamName: km3!.match.homeTeamName,
      awayTeamName: km3!.match.awayTeamName,
      leagueName: km3!.match.leagueName,
      kickoffAt: km3!.match.kickoffAt,
      homeScore: 1,
      awayScore: 1,
      status: "FINISHED",
    },
  ]);
  assert(km3!.matchId === seedMatchId, "C3. seed match ID preserved after API merge");

  settled = await getUserPredictionResultsLast7Days(USER_ID, "settled");
  assert(
    settled.some((item) => item.id === prediction3.id),
    "C6. merged prediction appears in settled on first read",
  );

  console.log("\nAll verification steps passed (including merge-id regression).");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
