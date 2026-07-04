import {
  TeamCompetitionBracketSide,
  TeamCompetitionKnockoutRoundType,
  type TeamCompetitionEntry,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import {
  knockoutRoundsForCapacity,
  type TeamCompetitionCapacity,
} from "@/shared/constants/team-competitions";
import { resetActiveEntryKnockoutRoundScores } from "@/server/services/team-competition-knockout-qualification";

export function pairsPerSide(capacity: number): number {
  return capacity / 4;
}

export function bracketSideForPairIndex(pairIndex: number, capacity: number): {
  side: TeamCompetitionBracketSide;
  groupIndex: number;
} {
  const perSide = pairsPerSide(capacity);
  if (pairIndex < perSide) {
    return { side: TeamCompetitionBracketSide.RIGHT, groupIndex: pairIndex };
  }
  return {
    side: TeamCompetitionBracketSide.LEFT,
    groupIndex: pairIndex - perSide,
  };
}

export function needsIntraRoundWave(
  capacity: number,
  roundType: TeamCompetitionKnockoutRoundType,
): boolean {
  return capacity === 8 && roundType === "ONE_QUARTER";
}

export function nextKnockoutRoundType(
  capacity: TeamCompetitionCapacity,
  current: TeamCompetitionKnockoutRoundType,
): TeamCompetitionKnockoutRoundType | null {
  const rounds = knockoutRoundsForCapacity(capacity);
  const idx = rounds.indexOf(current);
  if (idx < 0 || idx >= rounds.length - 1) return null;
  return rounds[idx + 1];
}

export async function assignSeedsAndPairs(teamCompetitionId: string) {
  const entries = await prisma.teamCompetitionEntry.findMany({
    where: { teamCompetitionId },
    orderBy: [{ rankingScore: "desc" }, { createdAt: "asc" }],
  });

  const n = entries.length;
  if (n < 2) return [];

  const seeded: Array<TeamCompetitionEntry & { seedRank: number }> = entries.map((e, i) => ({
    ...e,
    seedRank: i + 1,
  }));

  const pairCount = Math.floor(n / 2);
  const comp = await prisma.teamCompetition.findUniqueOrThrow({
    where: { id: teamCompetitionId },
  });
  const capacity = comp.teamCapacity as TeamCompetitionCapacity;

  const updates: Array<{
    id: string;
    seedRank: number;
    bracketSide: TeamCompetitionBracketSide;
    bracketGroupIndex: number;
    pairedEntryId: string | null;
  }> = [];

  for (let i = 0; i < pairCount; i++) {
    const high = seeded[i];
    const low = seeded[n - 1 - i];
    const { side, groupIndex } = bracketSideForPairIndex(i, capacity);

    updates.push({
      id: high.id,
      seedRank: high.seedRank,
      bracketSide: side,
      bracketGroupIndex: groupIndex,
      pairedEntryId: low.id,
    });
    updates.push({
      id: low.id,
      seedRank: low.seedRank,
      bracketSide: side,
      bracketGroupIndex: groupIndex,
      pairedEntryId: high.id,
    });
  }

  for (const u of updates) {
    await prisma.teamCompetitionEntry.update({
      where: { id: u.id },
      data: {
        seedRank: u.seedRank,
        bracketSide: u.bracketSide,
        bracketGroupIndex: u.bracketGroupIndex,
        pairedEntryId: u.pairedEntryId,
      },
    });
  }

  return updates;
}

export async function createInitialKnockoutFixtures(teamCompetitionId: string) {
  const comp = await prisma.teamCompetition.findUniqueOrThrow({
    where: { id: teamCompetitionId },
    include: { knockoutRounds: { orderBy: { sortOrder: "asc" } } },
  });

  const firstRound = comp.knockoutRounds[0];
  if (!firstRound) throw new Error("مرحله حذفی تعریف نشده");

  await resetActiveEntryKnockoutRoundScores(teamCompetitionId);

  const entries = await prisma.teamCompetitionEntry.findMany({
    where: { teamCompetitionId, pairedEntryId: { not: null }, seedRank: { not: null } },
    orderBy: { seedRank: "asc" },
  });

  const seen = new Set<string>();
  let fixtureIndex = 0;

  for (const entry of entries) {
    if (!entry.pairedEntryId || seen.has(entry.id)) continue;
    const partner = entries.find((e) => e.id === entry.pairedEntryId);
    if (!partner) continue;

    seen.add(entry.id);
    seen.add(partner.id);

    const high = (entry.seedRank ?? 0) < (partner.seedRank ?? 0) ? entry : partner;
    const low = high.id === entry.id ? partner : entry;

    await prisma.teamCompetitionKnockoutFixture.create({
      data: {
        teamCompetitionId,
        knockoutRoundId: firstRound.id,
        waveIndex: 0,
        fixtureIndex,
        bracketSide: high.bracketSide,
        entryAId: high.id,
        entryBId: low.id,
      },
    });
    fixtureIndex += 1;
  }
}

export async function createIntraRoundWaveFixtures(
  teamCompetitionId: string,
  knockoutRoundId: string,
  waveIndex: number,
  capacity: number,
) {
  const prevWave = waveIndex - 1;
  const resolved = await prisma.teamCompetitionKnockoutFixture.findMany({
    where: {
      teamCompetitionId,
      knockoutRoundId,
      waveIndex: prevWave,
      resolvedAt: { not: null },
      winnerEntryId: { not: null },
    },
    include: { winnerEntry: true },
    orderBy: { fixtureIndex: "asc" },
  });

  const perSide = pairsPerSide(capacity);
  const sides: TeamCompetitionBracketSide[] = [
    TeamCompetitionBracketSide.RIGHT,
    TeamCompetitionBracketSide.LEFT,
  ];

  let fixtureIndex = 0;
  for (const side of sides) {
    const winners = resolved
      .filter((f) => f.bracketSide === side && f.winnerEntry)
      .sort(
        (a, b) =>
          (a.winnerEntry!.bracketGroupIndex ?? 0) - (b.winnerEntry!.bracketGroupIndex ?? 0),
      );

    for (let i = 0; i + 1 < winners.length; i += 2) {
      const a = winners[i].winnerEntryId!;
      const b = winners[i + 1].winnerEntryId!;
      await prisma.teamCompetitionKnockoutFixture.create({
        data: {
          teamCompetitionId,
          knockoutRoundId,
          waveIndex,
          fixtureIndex,
          bracketSide: side,
          entryAId: a,
          entryBId: b,
        },
      });
      fixtureIndex += 1;
    }

    if (winners.length !== perSide) {
      // uneven — skip strict validation in dev
    }
  }
}

export async function createNextRoundFixtures(
  teamCompetitionId: string,
  fromRoundId: string,
  toRoundId: string,
) {
  await resetActiveEntryKnockoutRoundScores(teamCompetitionId);

  const comp = await prisma.teamCompetition.findUniqueOrThrow({
    where: { id: teamCompetitionId },
  });
  const capacity = comp.teamCapacity as TeamCompetitionCapacity;

  const resolved = await prisma.teamCompetitionKnockoutFixture.findMany({
    where: {
      teamCompetitionId,
      knockoutRoundId: fromRoundId,
      resolvedAt: { not: null },
      winnerEntryId: { not: null },
    },
    include: { winnerEntry: true },
    orderBy: [{ waveIndex: "desc" }, { fixtureIndex: "asc" }],
  });

  const latestWave = resolved.reduce((max, f) => Math.max(max, f.waveIndex), 0);
  const finalWaveWinners = resolved.filter((f) => f.waveIndex === latestWave);

  const sides: TeamCompetitionBracketSide[] = [
    TeamCompetitionBracketSide.RIGHT,
    TeamCompetitionBracketSide.LEFT,
  ];

  let fixtureIndex = 0;
  for (const side of sides) {
    const winners = finalWaveWinners
      .filter((f) => f.bracketSide === side && f.winnerEntry)
      .sort(
        (a, b) =>
          (a.winnerEntry!.bracketGroupIndex ?? 0) - (b.winnerEntry!.bracketGroupIndex ?? 0),
      );

    for (let i = 0; i + 1 < winners.length; i += 2) {
      await prisma.teamCompetitionKnockoutFixture.create({
        data: {
          teamCompetitionId,
          knockoutRoundId: toRoundId,
          waveIndex: 0,
          fixtureIndex,
          bracketSide: side,
          entryAId: winners[i].winnerEntryId!,
          entryBId: winners[i + 1].winnerEntryId!,
        },
      });
      fixtureIndex += 1;
    }
  }

  if (capacity === 8) {
    // two side champions → single final fixture
    const toRound = await prisma.teamCompetitionKnockoutRound.findUnique({
      where: { id: toRoundId },
    });
    if (toRound?.roundType === "FINAL" && fixtureIndex === 0) {
      const sideChamps = await getSideChampionsFromRound(teamCompetitionId, fromRoundId);
      if (sideChamps.right && sideChamps.left) {
        await prisma.teamCompetitionKnockoutFixture.create({
          data: {
            teamCompetitionId,
            knockoutRoundId: toRoundId,
            waveIndex: 0,
            fixtureIndex: 0,
            entryAId: sideChamps.right,
            entryBId: sideChamps.left,
          },
        });
      }
    }
  }
}

async function getSideChampionsFromRound(teamCompetitionId: string, roundId: string) {
  const fixtures = await prisma.teamCompetitionKnockoutFixture.findMany({
    where: { teamCompetitionId, knockoutRoundId: roundId, resolvedAt: { not: null } },
    orderBy: [{ waveIndex: "desc" }, { fixtureIndex: "asc" }],
  });
  const maxWave = fixtures.reduce((m, f) => Math.max(m, f.waveIndex), 0);
  const finalFixtures = fixtures.filter((f) => f.waveIndex === maxWave);

  let right: string | null = null;
  let left: string | null = null;
  for (const f of finalFixtures) {
    if (!f.winnerEntryId) continue;
    if (f.bracketSide === TeamCompetitionBracketSide.RIGHT) right = f.winnerEntryId;
    if (f.bracketSide === TeamCompetitionBracketSide.LEFT) left = f.winnerEntryId;
  }
  return { right, left };
}

export async function createFinalCrossSideFixture(
  teamCompetitionId: string,
  finalRoundId: string,
  rightEntryId: string,
  leftEntryId: string,
) {
  await resetActiveEntryKnockoutRoundScores(teamCompetitionId);

  const existing = await prisma.teamCompetitionKnockoutFixture.findFirst({
    where: { teamCompetitionId, knockoutRoundId: finalRoundId },
  });
  if (existing) return existing;

  return prisma.teamCompetitionKnockoutFixture.create({
    data: {
      teamCompetitionId,
      knockoutRoundId: finalRoundId,
      waveIndex: 0,
      fixtureIndex: 0,
      entryAId: rightEntryId,
      entryBId: leftEntryId,
    },
  });
}
