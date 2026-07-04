import { describe, expect, it } from "vitest";
import { readMatchScore } from "./football-data-api";

describe("readMatchScore", () => {
  it("uses fullTime only when match is FINISHED", () => {
    const score = readMatchScore({
      id: 1,
      utcDate: "2026-07-01T00:00:00Z",
      status: "FINISHED",
      homeTeam: { id: 1, name: "USA" },
      awayTeam: { id: 2, name: "BIH" },
      score: {
        fullTime: { home: 2, away: 0 },
        regularTime: { home: 1, away: 0 },
      },
    });
    expect(score).toEqual({ homeScore: 2, awayScore: 0 });
  });

  it("does not fall back to regularTime for FINISHED without fullTime", () => {
    const score = readMatchScore({
      id: 1,
      utcDate: "2026-07-01T00:00:00Z",
      status: "FINISHED",
      homeTeam: { id: 1, name: "USA" },
      awayTeam: { id: 2, name: "BIH" },
      score: {
        regularTime: { home: 1, away: 0 },
      },
    });
    expect(score).toEqual({ homeScore: null, awayScore: null });
  });

  it("uses regularTime for in-play matches", () => {
    const score = readMatchScore({
      id: 1,
      utcDate: "2026-07-01T00:00:00Z",
      status: "PAUSED",
      homeTeam: { id: 1, name: "USA" },
      awayTeam: { id: 2, name: "BIH" },
      score: {
        regularTime: { home: 1, away: 0 },
      },
    });
    expect(score).toEqual({ homeScore: 1, awayScore: 0 });
  });
});
