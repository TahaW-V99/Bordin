import { describe, expect, it } from "vitest";
import {
  readMatchScore,
  resolveFixtureSeasonForDate,
  resolveSeasonForConfiguredLeague,
} from "./fixture-api";

describe("readMatchScore", () => {
  it("uses fullTime only when match is FINISHED", () => {
    const score = readMatchScore({
      id: 1,
      utcDate: "2026-07-01T00:00:00Z",
      status: "FT",
      homeTeam: { id: 1, name: "USA" },
      awayTeam: { id: 2, name: "BIH" },
      score: {
        fullTime: { home: 2, away: 0 },
        regularTime: { home: 1, away: 0 },
      },
    });
    expect(score).toEqual({ homeScore: 2, awayScore: 0 });
  });

  it("falls back to regularTime for FINISHED when fullTime is missing", () => {
    const score = readMatchScore({
      id: 1,
      utcDate: "2026-07-01T00:00:00Z",
      status: "FT",
      homeTeam: { id: 1, name: "USA" },
      awayTeam: { id: 2, name: "BIH" },
      score: {
        regularTime: { home: 1, away: 0 },
      },
    });
    expect(score).toEqual({ homeScore: 1, awayScore: 0 });
  });

  it("uses regularTime for in-play matches", () => {
    const score = readMatchScore({
      id: 1,
      utcDate: "2026-07-01T00:00:00Z",
      status: "HT",
      homeTeam: { id: 1, name: "USA" },
      awayTeam: { id: 2, name: "BIH" },
      score: {
        regularTime: { home: 1, away: 0 },
      },
    });
    expect(score).toEqual({ homeScore: 1, awayScore: 0 });
  });
});

describe("resolveSeasonForConfiguredLeague", () => {
  it("uses calendar year for Brazil leagues in July", () => {
    expect(resolveSeasonForConfiguredLeague(71, "2026-07-22")).toBe(2026);
    expect(resolveSeasonForConfiguredLeague(72, "2026-07-22")).toBe(2026);
  });

  it("uses European campaign year for Premier League in July", () => {
    expect(resolveFixtureSeasonForDate("2026-07-22")).toBe(2025);
    expect(resolveSeasonForConfiguredLeague(39, "2026-07-22")).toBe(2025);
  });

  it("uses calendar year for European leagues from August", () => {
    expect(resolveSeasonForConfiguredLeague(39, "2026-08-01")).toBe(2026);
  });
});
