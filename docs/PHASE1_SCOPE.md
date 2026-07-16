# Phase 1 Scope Declaration

Phase 1 objective: **Kandakator sync and prediction read-path optimization** — user reads must not call VictoryAPI or perform settlement writes.

---

## In scope (must satisfy before production approval)

| Endpoint | Service chain | Verdict |
|----------|---------------|---------|
| `GET /api/kandakator` | `getKandakatorForDate` → DB read → `signalBackgroundSyncForKandakatorDates` → `scheduleKandakatorSettlement` | **PASS** |
| `GET /api/kandakator/today` | Same as above | **PASS** |
| `GET /api/profile/predictions` | `getUserPredictionResultsLast7Days` → DB read → `signalBackgroundWorkForRecentPredictions` (sync signal + `scheduleMatchPredictionsSettlement`) | **PASS** |
| `GET /api/kandakator/week` | `getTehranWeekDays` — static date keys only | **PASS** |
| Chat kandakator embed | `chat-service` → `getKandakatorForDate` | **PASS** |

Background-only (not user-blocking): sync queue processor, reconciliation tick, settlement scheduler, admin/internal routes.

---

## Explicitly excluded from Phase 1 scope

The following endpoints **do not** meet DB-read-only requirements today. They are **intentionally out of Phase 1** and deferred to **Phase 2 (Team Competition module)**:

| Endpoint | Violation |
|----------|-----------|
| `GET /api/team-competitions/[id]/leaderboard` | Synchronous `aggregateRankingScoresForCompetition` → DB writes (`teamCompetitionEntry.rankingScore`, `team.leaderboardRank`) + optional VictoryAPI via rule-based stage resolver |

Related read paths that remain excluded because they share the same aggregation/catalog stack:

- `GET /api/team-competitions/[id]?view=...` bracket path uses DB-only reads (**in scope** for detail/bracket)
- Team competition engine hooks on match settlement (background, not direct user read)

**Phase 1 approval applies to kandakator + prediction read paths only.** Team Competition leaderboard is not part of Phase 1 deliverables.

---

## Known violation outside both scopes (flagged, not blocking Phase 1 kandakator approval)

| Endpoint | Violation |
|----------|-----------|
| `GET /api/leaderboard/global` | `buildEligibleGlobalLeaderboard` → `ensureUserShowcaseSlug` may **write** `userProfile.showcaseSlug` on first read |

This is unrelated to kandakator sync Phase 1. Track as follow-up hygiene item.

---

## Phase 2 (Team Competition module) requirements

When Team Competition is brought in scope:

1. Remove `aggregateRankingScoresForCompetition` from `getTeamCompetitionLeaderboard` request path.
2. Remove `loadCatalogMatchesInRange` → `fetchMatchesInRange` → VictoryAPI from any user read.
3. Precomputed catalog cache + background refresh + DB-only reads.

See call graphs in Phase 1 verification report (conversation / agent transcript).
