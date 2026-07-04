# Match Sync & Prediction Lifecycle Architecture

## Root causes (why bugs reappeared)

### Issue 1 — Predictions stuck in "Registered"

| Root cause | Why it recurs |
|------------|---------------|
| Classification depends on `football_matches.homeScore/awayScore` in DB | Scores only arrive via external sync (CF Worker / GitHub Actions) |
| `ensureRecentPredictionsScored` triggered remote sync but **did not wait** for DB update | Same request returned stale data; user saw old tab |
| Settlement loop used **stale prediction list** fetched before sync | New scores not settled in same request |
| No persisted reconciliation | Deploy/restart cleared in-memory cooldowns; sync gaps lasted until manual refresh |

### Issue 2 — Fixture scores missing

| Root cause | Why it recurs |
|------------|---------------|
| `getKandakatorForDate` returned DB state immediately after fire-and-forget CF trigger | UI showed "در حال بروزرسانی" indefinitely |
| No frontend polling | Page held stale React state for 20+ minutes |
| `prepareKandakatorForDisplay` existed but was **never called** | Intended pre-display sync never ran |
| Scores require **both** `homeScore` and `awayScore` non-null | Partial API data silently stored as null |

### Issue 3 — Fixtures not auto-updating

| Root cause | Why it recurs |
|------------|---------------|
| **No Liara cron** — only external CF Worker + GitHub Actions | If secrets drift or scheduler fails, Liara has no fallback |
| CF Worker returns HTTP 200 before sync completes (`ctx.waitUntil`) | Failures invisible to app |
| CF syncs only ~4 days per 20-min run | Mid-week days lag |
| No persisted `lastSync` timestamp | No way to detect silent failure |
| `KANDAKATOR_SYNC_PUSH_TOKEN` must match across CF, GH, Liara | Token rotation stops all pushes |

## Permanent solution

### State machine (`src/shared/lib/match-lifecycle.ts`)

- **Match states:** `SCHEDULED` → `LIVE` → `AWAITING_RESULT` → `RESULT_KNOWN` → `FINISHED`
- **Prediction categories:** `registered` → `result_determined` → `scored`
- UI tabs derive category **only** from DB fields via `derivePredictionCategory()`

### Sync health (`kandakator_sync_records` + `system_event_logs`)

- Every push/reconcile writes a persisted record (survives deploy)
- `GET /api/internal/kandakator/health` — last success/failure, stale counts
- Structured logs: `[Bordin:match-lifecycle]`, `[Bordin:sync]`, `[Bordin:reconcile]`

### Reconciliation scheduler (every 5 min on Liara)

- Detects stale matches (kickoff passed, no scores)
- Detects unsettled predictions (scores known, `scoredAt` null)
- Detects orphan/partial score states
- Triggers remote sync **with DB polling** (up to 25s)
- Runs `settleAllFinishedMatches()`
- Records health metrics

### Read-path fixes

- `getKandakatorForDate`: calls `prepareKandakatorForDisplay` + `awaitKandakatorScoreRefresh({ waitForUpdate: true })`
- `ensureRecentPredictionsScored`: waits for sync, **re-fetches** unscored predictions
- Home dashboard: polls every 30s when matches need scores

## Scheduled jobs

| Job | Interval | Location | Role |
|-----|----------|----------|------|
| CF Worker cron | 20 min | `workers/kandakator-sync` | Fetch API → push to Liara |
| GitHub Actions | 20 min | `.github/workflows/kandakator-sync.yml` | Full week push |
| Prediction settlement | 5 min | `prediction-settlement-scheduler.ts` | Score predictions when DB has results |
| **Reconciliation** | 5 min | `kandakator-reconciliation-scheduler.ts` | Detect orphans, trigger sync, settle |
| Team competition | 5 min | `team-competition-scheduler.ts` | Team comp engine |

## Database fields

| Table | Fields |
|-------|--------|
| `football_matches` | `homeScore`, `awayScore`, `status`, `scoresUpdatedAt` |
| `predictions` | `scoredAt`, `accuracyPercent`, `coinsEarned`, `xpEarned` |
| `kandakator_sync_records` | sync health per scope |
| `system_event_logs` | match status / prediction category / sync audit |

## Verification

```bash
# E2E prediction lifecycle (memory DB)
npx tsx scripts/verify-prediction-settlement-e2e.ts

# Sync health (production/staging with token)
curl -H "Authorization: Bearer $KANDAKATOR_SYNC_PUSH_TOKEN" \
  https://bordin.ir/api/internal/kandakator/health
```

## Prevention checklist

1. Never classify predictions from frontend state — API uses lifecycle helpers
2. Never return kandakator data without attempting score refresh with wait
3. Monitor `/api/internal/kandakator/health` for `staleMatchCount > 0`
4. Keep `KANDAKATOR_SYNC_PUSH_TOKEN` identical on CF, GitHub, Liara
5. After deploy: `npm run db:push` then verify health endpoint
