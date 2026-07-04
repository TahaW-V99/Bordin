import type { TeamCompetitionKnockoutRoundType } from "@prisma/client";
import {
  knockoutRoundsForCapacity,
  type TeamCompetitionCapacity,
} from "@/shared/constants/team-competitions";

export type BracketTeam = {
  id: string;
  name: string;
  logoUrl: string | null;
  score: number;
  isEliminated: boolean;
  seedRank?: number | null;
  entryId?: string;
};

export type BracketFixture = {
  id: string;
  roundType: TeamCompetitionKnockoutRoundType;
  waveIndex: number;
  bracketSide: "LEFT" | "RIGHT" | null;
  fixtureIndex: number;
  entryAScore: number;
  entryBScore: number;
  resolved: boolean;
  winnerTeamId: string | null;
  left: BracketTeam | null;
  right: BracketTeam | null;
};

export type BracketMatchNode = {
  id: string;
  top: number;
  teamA: BracketTeam | null;
  teamB: BracketTeam | null;
  scoreA: number;
  scoreB: number;
  resolved: boolean;
  winnerTeamId: string | null;
  roundType: TeamCompetitionKnockoutRoundType;
  waveIndex: number;
};

export type BracketColumn = {
  key: string;
  roundType: TeamCompetitionKnockoutRoundType;
  waveIndex: number;
  labelFa: string;
  matches: BracketMatchNode[];
};

export type BracketSideTree = {
  columns: BracketColumn[];
  totalHeight: number;
};

export type BracketLayout = {
  right: BracketSideTree;
  left: BracketSideTree;
  final: BracketMatchNode | null;
  firstRoundPerSide: number;
};

export const BRACKET_HALF_UNIT = 56;
export const BRACKET_MATCH_HEIGHT = 108;
export const BRACKET_COLUMN_WIDTH = 168;
export const BRACKET_CONNECTOR_WIDTH = 40;

export function matchTopPx(roundIdx: number, matchIdx: number): number {
  return ((2 * matchIdx + 1) * 2 ** roundIdx - 1) * BRACKET_HALF_UNIT;
}

/** Vertical center of a fixed bracket slot — sole anchor for connectors. */
export function matchSlotCenterY(match: Pick<BracketMatchNode, "top">): number {
  return match.top + BRACKET_MATCH_HEIGHT / 2;
}

/** Final slot aligns with the innermost side-round winner anchor. */
export function finalMatchTopForCapacity(capacity: TeamCompetitionCapacity): number {
  const roundCols = sideRoundColumns(capacity);
  const lastRoundIdx = Math.max(0, roundCols.length - 1);
  return matchTopPx(lastRoundIdx, 0);
}

export function maxWaveForRound(
  capacity: TeamCompetitionCapacity,
  roundType: TeamCompetitionKnockoutRoundType,
): number {
  if (capacity === 8 && roundType === "ONE_QUARTER") return 1;
  return 0;
}

function sideRoundColumns(
  capacity: TeamCompetitionCapacity,
): Array<{ roundType: TeamCompetitionKnockoutRoundType; waveIndex: number }> {
  const rounds = knockoutRoundsForCapacity(capacity).filter((r) => r !== "FINAL");
  const cols: Array<{ roundType: TeamCompetitionKnockoutRoundType; waveIndex: number }> = [];
  for (const roundType of rounds) {
    const maxWave = maxWaveForRound(capacity, roundType);
    for (let waveIndex = 0; waveIndex <= maxWave; waveIndex++) {
      cols.push({ roundType, waveIndex });
    }
  }
  return cols;
}

function toMatchNode(
  fixture: BracketFixture,
  roundIdx: number,
  matchIdx: number,
): BracketMatchNode {
  return {
    id: fixture.id,
    top: matchTopPx(roundIdx, matchIdx),
    teamA: fixture.left,
    teamB: fixture.right,
    scoreA: fixture.entryAScore,
    scoreB: fixture.entryBScore,
    resolved: fixture.resolved,
    winnerTeamId: fixture.winnerTeamId,
    roundType: fixture.roundType,
    waveIndex: fixture.waveIndex,
  };
}

function buildSideTree(
  fixtures: BracketFixture[],
  side: "LEFT" | "RIGHT",
  capacity: TeamCompetitionCapacity,
  roundLabels: Record<TeamCompetitionKnockoutRoundType, string>,
): BracketSideTree {
  const roundCols = sideRoundColumns(capacity);
  const firstRoundPerSide = capacity / 4;
  const totalHeight = firstRoundPerSide * 2 * BRACKET_MATCH_HEIGHT;

  let columns: BracketColumn[] = roundCols
    .map((col, roundIdx) => {
      const colFixtures = fixtures
        .filter(
          (f) =>
            f.bracketSide === side &&
            f.roundType === col.roundType &&
            f.waveIndex === col.waveIndex,
        )
        .sort((a, b) => a.fixtureIndex - b.fixtureIndex);

      return {
        key: `${side}-${col.roundType}-${col.waveIndex}`,
        roundType: col.roundType,
        waveIndex: col.waveIndex,
        labelFa: roundLabels[col.roundType],
        matches: colFixtures.map((f, matchIdx) => toMatchNode(f, roundIdx, matchIdx)),
      };
    })
    .filter((col) => col.matches.length > 0);

  columns = columns.map((col, roundIdx) => ({
    ...col,
    matches: col.matches.map((m, matchIdx) => ({
      ...m,
      top: matchTopPx(roundIdx, matchIdx),
    })),
  }));

  return { columns, totalHeight };
}

export function buildBracketLayout(
  fixtures: BracketFixture[],
  capacity: TeamCompetitionCapacity,
  roundLabels: Record<TeamCompetitionKnockoutRoundType, string>,
): BracketLayout {
  const firstRoundPerSide = capacity / 4;
  const right = buildSideTree(fixtures, "RIGHT", capacity, roundLabels);
  const left = buildSideTree(fixtures, "LEFT", capacity, roundLabels);

  const finalFixture = fixtures.find((f) => f.roundType === "FINAL");
  const finalTop = finalMatchTopForCapacity(capacity);
  const final: BracketMatchNode | null = finalFixture
    ? {
        id: finalFixture.id,
        top: finalTop,
        teamA: finalFixture.left,
        teamB: finalFixture.right,
        scoreA: finalFixture.entryAScore,
        scoreB: finalFixture.entryBScore,
        resolved: finalFixture.resolved,
        winnerTeamId: finalFixture.winnerTeamId,
        roundType: "FINAL",
        waveIndex: 0,
      }
    : null;

  return { right, left, final, firstRoundPerSide };
}

/** Preview layout from seeded teams when fixtures are not generated yet. */
export function buildPreviewFirstRound(
  teams: BracketTeam[],
  capacity: TeamCompetitionCapacity,
  roundLabels: Record<TeamCompetitionKnockoutRoundType, string>,
): BracketLayout {
  const sorted = [...teams].sort(
    (a, b) => (b.score ?? 0) - (a.score ?? 0) || a.name.localeCompare(b.name, "fa"),
  );
  const perSide = capacity / 4;
  const pairCount = Math.floor(sorted.length / 2);
  const fixtures: BracketFixture[] = [];

  for (let i = 0; i < pairCount; i++) {
    const high = sorted[i];
    const low = sorted[sorted.length - 1 - i];
    const side = i < perSide ? "RIGHT" : "LEFT";
    const fixtureIndex = side === "RIGHT" ? i : i - perSide;
    const firstRound = knockoutRoundsForCapacity(capacity)[0];

    fixtures.push({
      id: `preview-${i}`,
      roundType: firstRound,
      waveIndex: 0,
      bracketSide: side,
      fixtureIndex,
      entryAScore: high?.score ?? 0,
      entryBScore: low?.score ?? 0,
      resolved: false,
      winnerTeamId: null,
      left: high ?? null,
      right: low ?? null,
    });
  }

  return buildBracketLayout(fixtures, capacity, roundLabels);
}
