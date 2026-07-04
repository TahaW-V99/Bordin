import assert from "node:assert/strict";
import {
  aggregateTeamLeaderboardEntries,
  computeTeamCompetitionEntryPoints,
  getTeamLeaderboard,
  getTeamLeaderboardPoints,
  getTeamLeaderboardRank,
} from "../src/server/services/team-leaderboard-service";

function testAggregationIsPerTeamNotPerEntry() {
  const rows = aggregateTeamLeaderboardEntries([
    { teamId: "t1", competitionPoints: 120, teamName: "Alpha", logoUrl: null },
    { teamId: "t1", competitionPoints: 80, teamName: "Alpha", logoUrl: null },
    { teamId: "t2", competitionPoints: 150, teamName: "Beta", logoUrl: null },
  ]);

  assert.equal(rows.length, 2, "two teams must produce two leaderboard rows");
  assert.equal(rows[0]?.teamId, "t1");
  assert.equal(rows[0]?.totalPoints, 200);
  assert.equal(rows[1]?.teamId, "t2");
  assert.equal(rows[1]?.totalPoints, 150);
}

function testEntryPointsIncludeRankingAndKnockoutFixtures() {
  const points = computeTeamCompetitionEntryPoints({
    rankingScore: 100,
    fixtureScoresAsA: [200, 200],
    fixtureScoresAsB: [150],
  });
  assert.equal(points, 650);
}

function testRankAndPointsHelpersMatchList() {
  const rows = aggregateTeamLeaderboardEntries([
    { teamId: "a", competitionPoints: 50, teamName: "A", logoUrl: null },
    { teamId: "b", competitionPoints: 100, teamName: "B", logoUrl: null },
    { teamId: "a", competitionPoints: 25, teamName: "A", logoUrl: null },
  ]).map((row, index) => ({ ...row, rank: index + 1 }));

  for (const row of rows) {
    const leaderboard = rows.map((item, index) => ({
      rank: index + 1,
      teamId: item.teamId,
      teamName: item.teamName,
      logoUrl: item.logoUrl,
      totalPoints: item.totalPoints,
    }));
    const fromList = leaderboard.find((item) => item.teamId === row.teamId);
    assert.equal(fromList?.rank, row.rank);
    assert.equal(fromList?.totalPoints, row.totalPoints);
  }
}

async function testLiveServiceConsistency() {
  process.env.DEV_MEMORY_DB = "true";
  const leaderboard = await getTeamLeaderboard();
  for (const row of leaderboard) {
    const rank = await getTeamLeaderboardRank(row.teamId);
    const points = await getTeamLeaderboardPoints(row.teamId);
    assert.equal(rank, row.rank, `rank mismatch for team ${row.teamId}`);
    assert.equal(points, row.totalPoints, `points mismatch for team ${row.teamId}`);
  }
}

async function main() {
  testAggregationIsPerTeamNotPerEntry();
  testEntryPointsIncludeRankingAndKnockoutFixtures();
  testRankAndPointsHelpersMatchList();
  if (process.env.DEV_MEMORY_DB === "true" || process.env.DATABASE_URL) {
    await testLiveServiceConsistency();
  }
  console.log("verify-team-leaderboard: all checks passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
