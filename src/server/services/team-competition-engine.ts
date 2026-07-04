import {
  TeamCompetitionKnockoutRoundType,
  TeamCompetitionStage,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import {
  knockoutRoundsForCapacity,
  type TeamCompetitionCapacity,
} from "@/shared/constants/team-competitions";
import { aggregateRankingScoresForCompetition } from "@/server/services/team-competition-aggregation";
import {
  assignSeedsAndPairs,
  createInitialKnockoutFixtures,
  createIntraRoundWaveFixtures,
  createNextRoundFixtures,
  createFinalCrossSideFixture,
  needsIntraRoundWave,
  nextKnockoutRoundType,
} from "@/server/services/team-competition-bracket";
import { computeCaptainKnockoutStageTotalScore } from "@/server/services/team-competition-knockout-qualification";
import { resolveKnockoutFixtureScores } from "@/server/services/team-competition-tiebreak";
import { distributeTeamCompetitionRewards } from "@/server/services/team-competition-rewards";
import { notifyKnockoutElimination } from "@/server/services/team-competition-user-service";
import {
  findRuleBasedCompetitionIdsForSettledMatch,
  isRuleBasedStageComplete,
  loadKnockoutRoundStageConfig,
  loadRankingStageConfig,
  syncAllRuleBasedStageCaches,
} from "@/server/services/team-competition-stage-resolver";

export async function processAllActiveTeamCompetitions() {
  if (await shouldUseMemoryDb()) return { processed: 0 };

  const comps = await prisma.teamCompetition.findMany({
    where: {
      isPublished: true,
      stage: { in: [TeamCompetitionStage.REGISTRATION, TeamCompetitionStage.RANKING, TeamCompetitionStage.KNOCKOUT, TeamCompetitionStage.FINISHED] },
    },
    select: { id: true },
  });

  let processed = 0;
  for (const comp of comps) {
    await processTeamCompetition(comp.id);
    processed += 1;
  }
  return { processed };
}

export async function processTeamCompetition(teamCompetitionId: string) {
  if (await shouldUseMemoryDb()) return;

  const comp = await prisma.teamCompetition.findUnique({
    where: { id: teamCompetitionId },
    include: {
      knockoutRounds: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!comp || !comp.isPublished) return;

  if (comp.usesRuleBasedStages) {
    await syncAllRuleBasedStageCaches(teamCompetitionId);
  }

  const now = new Date();

  if (comp.stage === TeamCompetitionStage.REGISTRATION && now > comp.registrationDeadline) {
    await prisma.teamCompetition.update({
      where: { id: teamCompetitionId },
      data: { stage: TeamCompetitionStage.RANKING },
    });
    return processTeamCompetition(teamCompetitionId);
  }

  if (comp.stage === TeamCompetitionStage.RANKING) {
    await aggregateRankingScoresForCompetition(teamCompetitionId);
    const shouldFinalize = comp.usesRuleBasedStages
      ? await (async () => {
          const config = await loadRankingStageConfig(teamCompetitionId);
          return config ? await isRuleBasedStageComplete(config) : false;
        })()
      : now > comp.rankingEndsAt;
    if (shouldFinalize) {
      await finalizeRankingAndStartKnockout(teamCompetitionId);
    }
    return;
  }

  if (comp.stage === TeamCompetitionStage.KNOCKOUT) {
    const currentRound = await getActiveKnockoutRound(teamCompetitionId, comp.knockoutRounds);
    if (currentRound) {
      const shouldResolve = comp.usesRuleBasedStages
        ? await (async () => {
            const config = await loadKnockoutRoundStageConfig(currentRound.id);
            return config ? await isRuleBasedStageComplete(config) : false;
          })()
        : Boolean(currentRound.endsAt && now > currentRound.endsAt);
      if (shouldResolve) {
        await resolveKnockoutRound(teamCompetitionId, currentRound.id);
      }
    }
    return;
  }

  if (comp.stage === TeamCompetitionStage.FINISHED && !comp.rewardsDistributedAt) {
    await distributeTeamCompetitionRewards(teamCompetitionId);
  }
}

export async function onMatchSettledForTeamCompetitions(matchId: string) {
  if (await shouldUseMemoryDb()) return;

  const stageLinks = await prisma.teamCompetitionStageMatch.findMany({
    where: { matchId },
    select: { teamCompetitionId: true },
  });
  const compIds = new Set(stageLinks.map((l) => l.teamCompetitionId));

  for (const id of await findRuleBasedCompetitionIdsForSettledMatch(matchId)) {
    await syncAllRuleBasedStageCaches(id);
    const linked = await prisma.teamCompetitionStageMatch.findFirst({
      where: { teamCompetitionId: id, matchId },
      select: { id: true },
    });
    if (linked) compIds.add(id);
  }

  for (const id of compIds) {
    const comp = await prisma.teamCompetition.findUnique({ where: { id } });
    if (!comp || !comp.isPublished) continue;

    const rankingConfig = await loadRankingStageConfig(id);
    let matchCountsForRanking = false;
    if (rankingConfig) {
      const match = await prisma.footballMatch.findUnique({
        where: { id: matchId },
        select: { kickoffAt: true, leagueName: true },
      });
      if (match) {
        const { leagueNameToCompetitionId } = await import(
          "@/server/services/admin-football-catalog-service"
        );
        matchCountsForRanking =
          match.kickoffAt >= rankingConfig.startsAt &&
          match.kickoffAt <= rankingConfig.endsAt &&
          rankingConfig.footballCompetitionIds.includes(
            leagueNameToCompetitionId(match.leagueName ?? "سایر"),
          );
      }
    }

    let shouldRefreshRanking = false;
    if (rankingConfig) {
      shouldRefreshRanking =
        comp.stage === TeamCompetitionStage.RANKING ||
        (comp.stage === TeamCompetitionStage.KNOCKOUT && matchCountsForRanking);
    } else if (comp.stage === TeamCompetitionStage.RANKING) {
      const linked = await prisma.teamCompetitionStageMatch.findFirst({
        where: { teamCompetitionId: id, matchId, stage: "RANKING" },
        select: { id: true },
      });
      shouldRefreshRanking = Boolean(linked);
    }

    if (shouldRefreshRanking) {
      if (comp.usesRuleBasedStages) {
        await syncAllRuleBasedStageCaches(id);
      }
      await aggregateRankingScoresForCompetition(id);
      if (comp.stage === TeamCompetitionStage.RANKING && comp.usesRuleBasedStages && rankingConfig) {
        if (await isRuleBasedStageComplete(rankingConfig)) {
          await finalizeRankingAndStartKnockout(id);
        }
      }
    }

    if (comp.stage === TeamCompetitionStage.KNOCKOUT) {
      if (comp.usesRuleBasedStages) {
        await syncAllRuleBasedStageCaches(id);
      }
      await refreshUnresolvedFixtureScores(id);
      await processTeamCompetition(id);
    }
  }
}

async function refreshUnresolvedFixtureScores(teamCompetitionId: string) {
  const fixtures = await prisma.teamCompetitionKnockoutFixture.findMany({
    where: { teamCompetitionId, resolvedAt: null, entryAId: { not: null }, entryBId: { not: null } },
    include: { knockoutRound: true },
  });

  for (const fixture of fixtures) {
    const [entryA, entryB] = await Promise.all([
      prisma.teamCompetitionEntry.findUniqueOrThrow({ where: { id: fixture.entryAId! } }),
      prisma.teamCompetitionEntry.findUniqueOrThrow({ where: { id: fixture.entryBId! } }),
    ]);
    const [scoreA, scoreB] = await Promise.all([
      computeCaptainKnockoutStageTotalScore(
        entryA.teamId,
        fixture.knockoutRoundId,
        entryA.knockoutRoundScoreBaseline,
      ),
      computeCaptainKnockoutStageTotalScore(
        entryB.teamId,
        fixture.knockoutRoundId,
        entryB.knockoutRoundScoreBaseline,
      ),
    ]);
    await prisma.teamCompetitionKnockoutFixture.update({
      where: { id: fixture.id },
      data: { entryAScore: scoreA, entryBScore: scoreB },
    });
    await prisma.teamCompetitionEntry.update({
      where: { id: entryA.id },
      data: { knockoutRoundScore: scoreA },
    });
    await prisma.teamCompetitionEntry.update({
      where: { id: entryB.id },
      data: { knockoutRoundScore: scoreB },
    });
  }

  const { syncTeamLeaderboardRanks } = await import(
    "@/server/services/team-leaderboard-rank-service"
  );
  await syncTeamLeaderboardRanks();
}

async function getActiveKnockoutRound(
  teamCompetitionId: string,
  rounds: Array<{ id: string; endsAt: Date | null; sortOrder: number; roundType: TeamCompetitionKnockoutRoundType }>,
) {
  const sorted = [...rounds].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const round of sorted) {
    const fixtureCount = await prisma.teamCompetitionKnockoutFixture.count({
      where: { teamCompetitionId, knockoutRoundId: round.id },
    });
    if (fixtureCount === 0) continue;

    const unresolved = await prisma.teamCompetitionKnockoutFixture.count({
      where: {
        teamCompetitionId,
        knockoutRoundId: round.id,
        resolvedAt: null,
        entryAId: { not: null },
      },
    });
    if (unresolved > 0) return round;

    const config = await loadKnockoutRoundStageConfig(round.id);
    if (config && !(await isRuleBasedStageComplete(config))) {
      return round;
    }
  }

  return getCurrentKnockoutRoundByTime(sorted);
}

function getCurrentKnockoutRoundByTime(
  rounds: Array<{ id: string; endsAt: Date | null; sortOrder: number; roundType: TeamCompetitionKnockoutRoundType }>,
) {
  const now = new Date();
  const sorted = [...rounds].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const round of sorted) {
    if (round.endsAt && now <= round.endsAt) return round;
  }
  return sorted[sorted.length - 1] ?? null;
}

async function finalizeRankingAndStartKnockout(teamCompetitionId: string) {
  const comp = await prisma.teamCompetition.findUniqueOrThrow({
    where: { id: teamCompetitionId },
    include: { knockoutRounds: { orderBy: { sortOrder: "asc" } } },
  });
  if (comp.bracketGeneratedAt) return;

  await aggregateRankingScoresForCompetition(teamCompetitionId);
  await assignSeedsAndPairs(teamCompetitionId);
  await createInitialKnockoutFixtures(teamCompetitionId);

  const firstRound = comp.knockoutRounds[0];
  await prisma.teamCompetition.update({
    where: { id: teamCompetitionId },
    data: {
      stage: TeamCompetitionStage.KNOCKOUT,
      rankingFinalizedAt: new Date(),
      bracketGeneratedAt: new Date(),
      knockoutStartsAt: comp.knockoutStartsAt ?? firstRound?.startsAt ?? new Date(),
    },
  });
}

async function resolveKnockoutRound(teamCompetitionId: string, knockoutRoundId: string) {
  const comp = await prisma.teamCompetition.findUniqueOrThrow({
    where: { id: teamCompetitionId },
    include: { knockoutRounds: { orderBy: { sortOrder: "asc" } } },
  });
  const round = comp.knockoutRounds.find((r) => r.id === knockoutRoundId);
  if (!round) return;

  const capacity = comp.teamCapacity as TeamCompetitionCapacity;

  const unresolvedFixtures = await prisma.teamCompetitionKnockoutFixture.findMany({
    where: {
      teamCompetitionId,
      knockoutRoundId,
      resolvedAt: null,
      entryAId: { not: null },
      entryBId: { not: null },
    },
  });

  for (const fixture of unresolvedFixtures) {
      if (!fixture.entryAId || !fixture.entryBId) continue;

      const [entryA, entryB] = await Promise.all([
        prisma.teamCompetitionEntry.findUniqueOrThrow({ where: { id: fixture.entryAId } }),
        prisma.teamCompetitionEntry.findUniqueOrThrow({ where: { id: fixture.entryBId } }),
      ]);

      const resolved = await resolveKnockoutFixtureScores({
        teamCompetitionId,
        knockoutRoundId,
        entryAId: entryA.id,
        entryBId: entryB.id,
        entryA,
        entryB,
      });

      await prisma.teamCompetitionKnockoutFixture.update({
        where: { id: fixture.id },
        data: {
          entryAScore: resolved.entryAScore,
          entryBScore: resolved.entryBScore,
          winnerEntryId: resolved.winnerEntryId,
          tieBreakApplied: resolved.tieBreakApplied,
          tieBreakWinnerId: resolved.tieBreakWinnerId,
          resolvedAt: new Date(),
        },
      });

      const loserEntry = resolved.loserEntryId === entryA.id ? entryA : entryB;
      if (!loserEntry.isEliminated) {
        await prisma.teamCompetitionEntry.update({
          where: { id: resolved.loserEntryId },
          data: { isEliminated: true },
        });
        await notifyKnockoutElimination(teamCompetitionId, loserEntry.teamId);
      }
      await prisma.teamCompetitionEntry.update({
        where: { id: resolved.winnerEntryId },
        data: { knockoutRoundScore: resolved.winnerEntryId === entryA.id ? resolved.entryAScore : resolved.entryBScore },
      });
  }

  if (unresolvedFixtures.length > 0) {
    const { syncTeamLeaderboardRanks } = await import(
      "@/server/services/team-leaderboard-rank-service"
    );
    await syncTeamLeaderboardRanks();
  }

  const stillUnresolved = await prisma.teamCompetitionKnockoutFixture.count({
    where: { teamCompetitionId, knockoutRoundId, resolvedAt: null, entryAId: { not: null } },
  });
  if (stillUnresolved > 0) return;

  const maxWave = await prisma.teamCompetitionKnockoutFixture.aggregate({
    where: { teamCompetitionId, knockoutRoundId, resolvedAt: { not: null } },
    _max: { waveIndex: true },
  });
  const waveIndex = maxWave._max.waveIndex ?? 0;

  const hasNextWave =
    needsIntraRoundWave(capacity, round.roundType) &&
    waveIndex === 0 &&
    (await prisma.teamCompetitionKnockoutFixture.count({
      where: { teamCompetitionId, knockoutRoundId, waveIndex: 1 },
    })) === 0;

  if (hasNextWave) {
    await createIntraRoundWaveFixtures(teamCompetitionId, knockoutRoundId, 1, capacity);
    return;
  }

  const wave1Unresolved = await prisma.teamCompetitionKnockoutFixture.count({
    where: { teamCompetitionId, knockoutRoundId, waveIndex: 1, resolvedAt: null },
  });
  if (wave1Unresolved > 0) return;

  await advanceAfterRoundComplete(teamCompetitionId, comp, round);
}

async function advanceAfterRoundComplete(
  teamCompetitionId: string,
  comp: Awaited<ReturnType<typeof prisma.teamCompetition.findUniqueOrThrow>> & {
    knockoutRounds: Array<{
      id: string;
      roundType: TeamCompetitionKnockoutRoundType;
      endsAt: Date | null;
      sortOrder: number;
    }>;
  },
  round: { id: string; roundType: TeamCompetitionKnockoutRoundType; endsAt: Date | null },
) {
  const capacity = comp.teamCapacity as TeamCompetitionCapacity;

  if (round.roundType === TeamCompetitionKnockoutRoundType.FINAL) {
    const finalFixture = await prisma.teamCompetitionKnockoutFixture.findFirst({
      where: { teamCompetitionId, knockoutRoundId: round.id, resolvedAt: { not: null } },
      orderBy: { resolvedAt: "desc" },
    });
    if (!finalFixture?.winnerEntryId || !finalFixture.entryAId || !finalFixture.entryBId) return;

    const winnerId = finalFixture.winnerEntryId;
    const runnerUpId =
      winnerId === finalFixture.entryAId ? finalFixture.entryBId : finalFixture.entryAId;

    await prisma.teamCompetition.update({
      where: { id: teamCompetitionId },
      data: {
        stage: TeamCompetitionStage.FINISHED,
        winnerEntryId: winnerId,
        runnerUpEntryId: runnerUpId,
        finishedAt: new Date(),
        knockoutEndsAt: round.endsAt ?? new Date(),
      },
    });
    await distributeTeamCompetitionRewards(teamCompetitionId);
    return;
  }

  const nextType = nextKnockoutRoundType(capacity, round.roundType);
  if (!nextType) return;

  const nextRound = comp.knockoutRounds.find((r) => r.roundType === nextType);
  if (!nextRound) return;

  const existingNext = await prisma.teamCompetitionKnockoutFixture.count({
    where: { teamCompetitionId, knockoutRoundId: nextRound.id },
  });
  if (existingNext > 0) return;

  if (
    round.roundType === "ONE_QUARTER" &&
    (capacity === 8 || capacity === 16 || capacity === 32)
  ) {
    const sideChamps = await getSideChampionEntryIds(teamCompetitionId, round.id);
    if (sideChamps.right && sideChamps.left) {
      const finalRound = comp.knockoutRounds.find((r) => r.roundType === "FINAL");
      if (finalRound) {
        await createFinalCrossSideFixture(
          teamCompetitionId,
          finalRound.id,
          sideChamps.right,
          sideChamps.left,
        );
      }
      return;
    }
  }

  await createNextRoundFixtures(teamCompetitionId, round.id, nextRound.id);
}

async function getSideChampionEntryIds(teamCompetitionId: string, roundId: string) {
  const fixtures = await prisma.teamCompetitionKnockoutFixture.findMany({
    where: { teamCompetitionId, knockoutRoundId: roundId, resolvedAt: { not: null } },
    orderBy: [{ waveIndex: "desc" }, { fixtureIndex: "asc" }],
  });
  const maxWave = fixtures.reduce((m, f) => Math.max(m, f.waveIndex), 0);
  const last = fixtures.filter((f) => f.waveIndex === maxWave);

  let right: string | null = null;
  let left: string | null = null;
  for (const f of last) {
    if (!f.winnerEntryId) continue;
    if (f.bracketSide === "RIGHT") right = f.winnerEntryId;
    if (f.bracketSide === "LEFT") left = f.winnerEntryId;
  }
  return { right, left };
}
