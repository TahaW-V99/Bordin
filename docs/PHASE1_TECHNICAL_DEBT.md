# Phase 1 Technical Debt

Items intentionally deferred from Phase 1. Do not implement here without explicit approval.

---

## TD-1: Durable settlement queue (replaces in-process debounce)

**Current (Phase 1):** `settlement-scheduler.ts` uses in-memory `Set` debounce (60s) for:

- `scheduleKandakatorSettlement(kandakatorId)`
- `scheduleMatchPredictionsSettlement(matchIds)`

**Problem:** State is lost on restart. No at-least-once delivery, no DLQ, no metrics.

**Phase 2 recommendation:**

- Add `settlement_jobs` table (matchId or kandakatorId, status, attemptCount, lockedAt).
- Worker on tick processes N jobs; idempotent `settleMatchPredictions`.
- User reads enqueue jobs; never execute settlement inline.

**Files:** `src/server/services/settlement-scheduler.ts`, `kandakator-sync-service.ts` (sync processor settlement after ingest remains valid background path).

---

## TD-2: Team competition aggregation must not fetch Football API during user requests

**Current (Phase 1 — unchanged):** `loadCatalogMatchesInRange()` in `admin-football-catalog-service.ts` calls VictoryAPI when configured:

```typescript
const apiMatches = await fetchMatchesInRange(dateFrom, dateTo, { noCache: true });
```

**User-facing callers (violations):**

| Path | Function |
|------|----------|
| Team competition leaderboard | `getTeamCompetitionLeaderboard()` → `aggregateRankingScoresForCompetition()` |
| Match settlement hook | `onMatchSettledForTeamCompetitions()` → stage resolver |
| Team competition detail (some flows) | `team-competition-user-service.ts` |

**Impact:** Leaderboard/aggregation reads can trigger VictoryAPI calls and heavy DB writes synchronously on user request.

**Phase 2 recommendation:**

1. **Precomputed catalog cache** — `football_catalog_snapshots` or extend `football_matches` with scheduled range backfill.
2. **Background refresh** — admin/cron enqueues catalog refresh jobs; `loadCatalogMatchesInRange` reads DB only on user path.
3. **Database-only reads** — user aggregation reads cached stage match IDs + scores from DB; never calls `fetchMatchesInRange` inline.

**Files to change (Phase 2):**

- `src/server/services/admin-football-catalog-service.ts`
- `src/server/services/team-competition-stage-resolver.ts`
- `src/server/services/team-competition-user-service.ts`
- `src/server/services/team-competition-aggregation.ts`

---

## TD-3: Team competition leaderboard writes on read path

**Current:** `getTeamCompetitionLeaderboard()` calls `aggregateRankingScoresForCompetition()` synchronously before returning rows.

**Phase 2:** Signal background aggregation; return last persisted `rankingScore` from DB. Same durable queue pattern as TD-2.

---

## Metrics (post-deploy — do not estimate in Phase 1)

After staging/production deploy, measure:

| Metric | Source |
|--------|--------|
| Football API calls/day | VictoryAPI dashboard; `kandakator_sync_jobs.lastFetchedAt` |
| Sync jobs/day | `kandakator_sync_jobs` CREATE count |
| Avg API calls/job | Processor logs; typically 1 `fetchMatchesForTehranDate` per completed job |
| Duplicate prevented jobs | `[Bordin:sync-queue]` logs with `event: enqueue_skipped` |

**GitHub Actions per run (enqueue only, no direct API):**

- Evaluates **7 Tehran week dates** via `enqueueKandakatorSyncDatesIfNeeded` (no `force`).
- **Jobs created:** 0–7 depending on `evaluateDateSyncNeed()` (most runs expect majority `recent_completed_fresh`, `future_far_scheduled`, `open_job`).
- **Skipped:** returned in response `skipped[]` with reason per date.
- **API calls triggered by Action:** **0** — Action only POSTs to `/api/internal/kandakator/enqueue`. VictoryAPI runs in queue processor (`processKandakatorSyncQueue`) on Liara tick (60s, 2 jobs/cycle) or when jobs are otherwise processed.

**Typical steady-state run:**

| Outcome | Count (approx.) |
|---------|-----------------|
| Dates evaluated | 7 |
| Jobs created | 0–2 (yesterday/today if LIVE or awaiting result) |
| Skipped | 5–7 |
| API calls from Action itself | 0 |
| API calls from subsequent tick processing | 0–2 (one per newly created job) |

Exact counts require staging/production log analysis after deploy.
