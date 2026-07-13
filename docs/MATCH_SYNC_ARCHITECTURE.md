# Match Sync & Prediction Lifecycle Architecture

## Root causes (why bugs reappeared)

### Issue 1 — Predictions stuck in "Registered"

| Root cause | Why it recurs |
|------------|---------------|
| Classification depends on `football_matches.homeScore/awayScore` in DB | Scores only arrive via Fixture API sync |
| `ensureRecentPredictionsScored` triggered sync but **did not wait** for DB update | Same request returned stale data; user saw old tab |
| Settlement loop used **stale prediction list** fetched before sync | New scores not settled in same request |
| No persisted reconciliation | Deploy/restart cleared in-memory cooldowns; sync gaps lasted until manual refresh |

### Issue 2 — Fixture scores missing

| Root cause | Why it recurs |
|------------|---------------|
| `getKandakatorForDate` returned DB state immediately after fire-and-forget sync | UI showed stale scores |
| No frontend polling | Page held stale React state for 20+ minutes |
| `prepareKandakatorForDisplay` existed but was **never called** | Intended pre-display sync never ran |
| Scores require **both** `homeScore` and `awayScore` non-null | Partial API data silently stored as null |

### Issue 3 — Fixtures not auto-updating

| Root cause | Why it recurs |
|------------|---------------|
| Queue processor not running on schedule | Jobs pile up without tick/reconcile |
| No persisted `lastSync` timestamp | No way to detect silent failure |
| `KANDAKATOR_SYNC_PUSH_TOKEN` must match across GitHub and Liara | Token rotation stops enqueue pushes |
| `FIXTURE_API_KEY` missing or `KANDAKATOR_RUNTIME_SYNC=false` | Server cannot fetch fixtures directly |

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
- Enqueues sync jobs and polls DB (up to 25s when requested)
- Runs `settleAllFinishedMatches()`
- Records health metrics

### Read-path fixes

- `getKandakatorForDate`: calls `prepareKandakatorForDisplay` + queue processing
- `ensureRecentPredictionsScored`: waits for sync, **re-fetches** unscored predictions
- Home dashboard: polls every 30s when matches need scores

## Scheduled jobs

| Job | Interval | Location | Role |
|-----|----------|----------|------|
| GitHub Actions | 20 min | `.github/workflows/kandakator-sync.yml` | Enqueue week sync on app |
| Queue processor | on tick/reconcile | `kandakator-sync-queue-processor.ts` | Fetch Fixture API → write DB |
| Prediction settlement | 5 min | `prediction-settlement-scheduler.ts` | Score predictions when DB has results |
| **Reconciliation** | 5 min | `kandakator-reconciliation-scheduler.ts` | Detect orphans, enqueue sync, settle |
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
4. Keep `KANDAKATOR_SYNC_PUSH_TOKEN` identical on GitHub and Liara
5. Set `FIXTURE_API_KEY` and `KANDAKATOR_RUNTIME_SYNC=true` on staging/production
6. After deploy: `npm run db:push` then verify health endpoint
