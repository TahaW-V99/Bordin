import assert from "node:assert/strict";
import {
  formatSystemLevelMessage,
  formatSystemMedalMessage,
  formatSystemPerfectPredictionMessage,
  isAllowedChatReaction,
  resolveCredibilityTier,
} from "../src/shared/lib/chat-logic";
import { CHAT_TEAMS_ACCESS_DENIED_FA } from "../src/shared/constants/chat";
function testCredibilityPrecedence() {
  assert.equal(
    resolveCredibilityTier({ globalRank: 2, levelRank: 8, medalCount: 5 }),
    "top5",
  );
  assert.equal(
    resolveCredibilityTier({ globalRank: 12, levelRank: 7, medalCount: 1 }),
    "veteran",
  );
  assert.equal(
    resolveCredibilityTier({ globalRank: null, levelRank: 3, medalCount: 3 }),
    "medalist",
  );
  assert.equal(
    resolveCredibilityTier({ globalRank: null, levelRank: 3, medalCount: 1 }),
    null,
  );
}

function testReactionsAllowlist() {
  assert.equal(isAllowedChatReaction("⚽"), true);
  assert.equal(isAllowedChatReaction("👍"), false);
}

function testSystemMessages() {  assert.match(formatSystemMedalMessage("علی", "شکارچی برنز"), /علی مدال شکارچی برنز گرفت/);
  assert.match(formatSystemLevelMessage("علی", "کاپیتان بُردین"), /علی وارد سطح کاپیتان بُردین شد/);
  assert.match(formatSystemPerfectPredictionMessage("علی"), /علی پیش‌بینی ۱۰۰٪ ثبت کرد/);
}

function testAccessControlRules() {
  assert.equal(CHAT_TEAMS_ACCESS_DENIED_FA.length > 10, true);
}

async function testSharePayloadGuards() {
  const { isPredictionResultPayload, isDuelChallengePayload } = await import(
    "../src/shared/lib/chat-payloads"
  );
  assert.equal(
    isPredictionResultPayload({
      predictionId: "p1",
      homeTeamName: "A",
      awayTeamName: "B",
      leagueName: null,
      homePrediction: 1,
      awayPrediction: 0,
      homeScore: 1,
      awayScore: 0,
      accuracyPercent: 100,
      coinsEarned: 10,
      xpEarned: 5,
    }),
    true,
  );
  assert.equal(
    isDuelChallengePayload({
      duelId: "d1",
      challengerId: "u1",
      challengerName: "A",
      opponentId: "u2",
      opponentName: "B",
      matches: [
        {
          matchId: "m1",
          homeTeamName: "X",
          awayTeamName: "Y",
          kickoffAt: new Date().toISOString(),
        },
      ],
    }),
    true,
  );
}

async function main() {
  testCredibilityPrecedence();
  testReactionsAllowlist();
  testSystemMessages();
  testAccessControlRules();
  await testSharePayloadGuards();
  console.log("verify-chat-social: all checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
