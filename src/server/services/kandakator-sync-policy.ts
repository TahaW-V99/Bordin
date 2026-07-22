import { addDays } from "date-fns";
import { SyncJobStatus } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { kandakatorDateFromKey } from "@/shared/lib/dates";
import { isMatchResultKnown } from "@/shared/lib/match-result";
import { tehranDateKey } from "@/server/memory/kandakator-seed";
import { countStaleMatchesForDate } from "@/server/services/kandakator-reconciliation-service";
import { getTehranWeekDays } from "@/server/services/kandakator-service";

type KandakatorSnapshot = {
  id: string;
  matches: Array<{
    match: {
      externalId: string | null;
      status: string;
      kickoffAt: Date;
      homeScore: number | null;
      awayScore: number | null;
    };
  }>;
} | null;

type SyncUrgency = "critical" | "medium" | "low" | "none";

export type DateSyncEvaluation = {
  shouldEnqueue: boolean;
  reason: string;
};

export type EvaluateDateSyncNeedInput = {
  dateKey: string;
  force?: boolean;
  source?: string;
};

const DEFAULT_FRESHNESS_LIVE_MS = 5 * 60 * 1000;
const DEFAULT_FRESHNESS_URGENT_MS = 15 * 60 * 1000;
const DEFAULT_FRESHNESS_DEFAULT_MS = 30 * 60 * 1000;
const DEFAULT_FRESHNESS_FUTURE_MS = 6 * 60 * 60 * 1000;
const DEFAULT_UPCOMING_KICKOFF_WINDOW_MS = 45 * 60 * 1000;
const DEFAULT_DEAD_LETTER_COOLDOWN_MS = 2 * 60 * 60 * 1000;
const DEFAULT_MAX_PENDING_QUEUE = 50;

function readEnvMs(name: string, fallback: number) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function freshnessLiveMs() {
  return readEnvMs("KANDAKATOR_SYNC_FRESHNESS_LIVE_MS", DEFAULT_FRESHNESS_LIVE_MS);
}

function freshnessUrgentMs() {
  return readEnvMs("KANDAKATOR_SYNC_FRESHNESS_URGENT_MS", DEFAULT_FRESHNESS_URGENT_MS);
}

function freshnessDefaultMs() {
  return readEnvMs("KANDAKATOR_SYNC_FRESHNESS_DEFAULT_MS", DEFAULT_FRESHNESS_DEFAULT_MS);
}

function freshnessFutureMs() {
  return readEnvMs("KANDAKATOR_SYNC_FRESHNESS_FUTURE_MS", DEFAULT_FRESHNESS_FUTURE_MS);
}

function upcomingKickoffWindowMs() {
  return readEnvMs("KANDAKATOR_UPCOMING_KICKOFF_WINDOW_MS", DEFAULT_UPCOMING_KICKOFF_WINDOW_MS);
}

function deadLetterCooldownMs() {
  return readEnvMs("KANDAKATOR_DEAD_LETTER_COOLDOWN_MS", DEFAULT_DEAD_LETTER_COOLDOWN_MS);
}

function maxPendingQueueDepth() {
  const raw = process.env.KANDAKATOR_SYNC_MAX_PENDING?.trim();
  if (!raw) return DEFAULT_MAX_PENDING_QUEUE;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : DEFAULT_MAX_PENDING_QUEUE;
}

function tehranDayStart(dateKey: string) {
  return kandakatorDateFromKey(dateKey);
}

async function loadKandakatorSnapshot(dateKey: string): Promise<KandakatorSnapshot> {
  const dayStart = tehranDayStart(dateKey);
  return prisma.dailyKandakator.findFirst({
    where: {
      date: { gte: dayStart, lt: addDays(dayStart, 1) },
      isPublished: true,
    },
    include: {
      matches: {
        include: {
          match: {
            select: {
              externalId: true,
              status: true,
              kickoffAt: true,
              homeScore: true,
              awayScore: true,
            },
          },
        },
      },
    },
  });
}

/** Whether published kandakator data for a date still needs a VictoryAPI refresh. */
export function kandakatorNeedsApiRefresh(dateKey: string, existing: KandakatorSnapshot) {
  if (!existing || existing.matches.length === 0) return true;

  const hasApiMatches = existing.matches.some((row) => Boolean(row.match.externalId));
  if (!hasApiMatches) return true;

  const now = Date.now();
  const todayKey = tehranDateKey(new Date());

  for (const { match } of existing.matches) {
    if (match.status === "LIVE") return true;
    if (!isMatchResultKnown(match) && match.kickoffAt.getTime() <= now) return true;
  }

  if (dateKey < todayKey) {
    return !existing.matches.every(({ match }) => isMatchResultKnown(match));
  }

  if (dateKey === todayKey) {
    return existing.matches.some(
      ({ match }) =>
        match.status === "LIVE" ||
        (!isMatchResultKnown(match) && match.kickoffAt.getTime() <= now),
    );
  }

  return false;
}

function hasLiveMatch(snapshot: KandakatorSnapshot) {
  return snapshot?.matches.some(({ match }) => match.status === "LIVE") ?? false;
}

function hasAwaitingResult(snapshot: KandakatorSnapshot) {
  const now = Date.now();
  return (
    snapshot?.matches.some(
      ({ match }) =>
        !isMatchResultKnown(match) && match.kickoffAt.getTime() <= now,
    ) ?? false
  );
}

function hasFinishedMissingScores(snapshot: KandakatorSnapshot) {
  return (
    snapshot?.matches.some(
      ({ match }) =>
        match.status === "FINISHED" &&
        (match.homeScore === null || match.awayScore === null),
    ) ?? false
  );
}

function hasUpcomingKickoffWithinWindow(snapshot: KandakatorSnapshot, windowMs: number) {
  const now = Date.now();
  return (
    snapshot?.matches.some(
      ({ match }) =>
        match.status === "SCHEDULED" &&
        match.kickoffAt.getTime() > now &&
        match.kickoffAt.getTime() - now <= windowMs,
    ) ?? false
  );
}

function hasFarFutureScheduledOnly(snapshot: KandakatorSnapshot, windowMs: number) {
  if (!snapshot || snapshot.matches.length === 0) return false;
  const now = Date.now();
  return snapshot.matches.every(
    ({ match }) =>
      match.status === "SCHEDULED" && match.kickoffAt.getTime() - now > windowMs,
  );
}

function classifySyncUrgency(dateKey: string, snapshot: KandakatorSnapshot): SyncUrgency {
  if (!snapshot || snapshot.matches.length === 0) return "critical";

  const todayKey = tehranDateKey(new Date());
  const windowMs = upcomingKickoffWindowMs();

  if (hasLiveMatch(snapshot)) return "critical";
  if (hasAwaitingResult(snapshot)) return "critical";
  if (hasFinishedMissingScores(snapshot)) return "critical";

  if (hasUpcomingKickoffWithinWindow(snapshot, windowMs)) {
    return "medium";
  }

  if (dateKey > todayKey && hasFarFutureScheduledOnly(snapshot, windowMs)) {
    return "none";
  }

  if (kandakatorNeedsApiRefresh(dateKey, snapshot)) {
    return "low";
  }

  return "none";
}

function freshnessMsForUrgency(urgency: SyncUrgency, dateKey: string, snapshot: KandakatorSnapshot) {
  if (urgency === "critical" && hasLiveMatch(snapshot)) {
    return freshnessLiveMs();
  }
  if (urgency === "critical") {
    return freshnessUrgentMs();
  }
  if (urgency === "medium" || urgency === "low") {
    return freshnessDefaultMs();
  }
  if (dateKey > tehranDateKey(new Date())) {
    return freshnessFutureMs();
  }
  return freshnessDefaultMs();
}

function isWithinCompletedFreshness(
  dateKey: string,
  urgency: SyncUrgency,
  snapshot: KandakatorSnapshot,
  completedAt: Date,
) {
  const freshnessMs = freshnessMsForUrgency(urgency, dateKey, snapshot);
  return Date.now() - completedAt.getTime() < freshnessMs;
}

function criticalLifecycleReason(snapshot: KandakatorSnapshot) {
  if (hasLiveMatch(snapshot)) return "lifecycle_live";
  if (hasAwaitingResult(snapshot)) return "lifecycle_awaiting_result";
  if (hasFinishedMissingScores(snapshot)) return "lifecycle_missing_scores";
  return "lifecycle_refresh";
}

async function hasOpenSyncJob(dateKey: string) {
  return prisma.kandakatorSyncJob.findFirst({
    where: {
      dateKey,
      status: { in: [SyncJobStatus.PENDING, SyncJobStatus.PROCESSING] },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function hasRetryScheduledJob(dateKey: string) {
  return prisma.kandakatorSyncJob.findFirst({
    where: {
      dateKey,
      status: SyncJobStatus.FAILED,
      nextAttemptAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function getLatestDeadLetterJob(dateKey: string) {
  return prisma.kandakatorSyncJob.findFirst({
    where: {
      dateKey,
      status: SyncJobStatus.DEAD_LETTER,
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function hasRecentDeadLetter(dateKey: string) {
  const latest = await getLatestDeadLetterJob(dateKey);
  if (!latest) return false;
  return Date.now() - latest.updatedAt.getTime() < deadLetterCooldownMs();
}

async function isQueueBackpressureActive() {
  const pendingDepth = await prisma.kandakatorSyncJob.count({
    where: {
      status: {
        in: [SyncJobStatus.PENDING, SyncJobStatus.PROCESSING, SyncJobStatus.FAILED],
      },
    },
  });
  return pendingDepth >= maxPendingQueueDepth();
}

async function getLatestCompletedJob(dateKey: string) {
  return prisma.kandakatorSyncJob.findFirst({
    where: {
      dateKey,
      status: SyncJobStatus.COMPLETED,
      lastVerifiedAt: { not: null },
    },
    orderBy: { lastVerifiedAt: "desc" },
  });
}

async function hasUnsettledPredictionsForDate(dateKey: string) {
  const dayStart = tehranDayStart(dateKey);
  const dayEnd = addDays(dayStart, 1);

  const count = await prisma.prediction.count({
    where: {
      scoredAt: null,
      match: {
        kickoffAt: { gte: dayStart, lt: dayEnd },
        homeScore: { not: null },
        awayScore: { not: null },
      },
    },
  });

  return count > 0;
}

async function hasPartialScoresForDate(dateKey: string) {
  const dayStart = tehranDayStart(dateKey);
  const dayEnd = addDays(dayStart, 1);

  const count = await prisma.footballMatch.count({
    where: {
      kickoffAt: { gte: dayStart, lt: dayEnd },
      kandakatorMatches: { some: { kandakator: { isPublished: true } } },
      OR: [
        { homeScore: { not: null }, awayScore: null },
        { homeScore: null, awayScore: { not: null } },
      ],
    },
  });

  return count > 0;
}

function rediscoveryIntervalMsForDate(dateKey: string) {
  const todayKey = tehranDateKey(new Date());
  const today = kandakatorDateFromKey(todayKey);
  const yesterdayKey = tehranDateKey(addDays(today, -1));
  const tomorrowKey = tehranDateKey(addDays(today, 1));

  if ([yesterdayKey, todayKey, tomorrowKey].includes(dateKey)) {
    return readEnvMs("KANDAKATOR_NEAR_DATE_REDISCOVERY_MS", 60 * 60 * 1000);
  }

  const weekDates = new Set(getTehranWeekDays().map((day) => day.date));
  if (weekDates.has(dateKey)) {
    return readEnvMs("KANDAKATOR_WEEK_REDISCOVERY_MS", 6 * 60 * 60 * 1000);
  }

  return null;
}

async function needsPeriodicRediscovery(dateKey: string) {
  const intervalMs = rediscoveryIntervalMsForDate(dateKey);
  if (intervalMs == null) return false;

  const completedJob = await getLatestCompletedJob(dateKey);
  if (!completedJob?.lastVerifiedAt) return true;

  return Date.now() - completedJob.lastVerifiedAt.getTime() >= intervalMs;
}

/**
 * Decision table (priority: force → backpressure → open job → retry → dead letter →
 * discovery → DB issues → completed freshness → lifecycle urgency):
 *
 * | Scenario                                      | Enqueue? | reason                         |
 * |-----------------------------------------------|----------|--------------------------------|
 * | force=true                                    | Yes      | force                          |
 * | Global pending queue at limit                 | No       | queue_backpressure             |
 * | PENDING/PROCESSING job exists                 | No       | open_job                       |
 * | FAILED job, retry in future                   | No       | retry_scheduled                |
 * | Recent DEAD_LETTER within cooldown            | No       | recent_dead_letter             |
 * | No published kandakator / empty day           | Yes      | discovery                      |
 * | LIVE match                                    | Yes*     | lifecycle_live                 |
 * | Kickoff passed, scores missing                | Yes*     | lifecycle_awaiting_result      |
 * | FINISHED without both scores                  | Yes*     | lifecycle_missing_scores       |
 * | Unsettled predictions (scores in DB)          | Yes      | unsettled_predictions          |
 * | Partial scores in DB                          | Yes      | partial_scores                 |
 * | Upcoming kickoff within window (30–60 min)    | Yes*     | upcoming_pre_kickoff           |
 * | Far-future date, all scheduled beyond window  | No       | future_far_scheduled           |
 * | Past/today all matches settled                | No       | all_settled                    |
 * | Recent COMPLETED within freshness window      | No       | recent_completed_fresh         |
 *
 * *Subject to completed-job freshness suppression (shorter for LIVE / awaiting-result, longer for far future).
 */
export async function evaluateDateSyncNeed(
  input: EvaluateDateSyncNeedInput,
): Promise<DateSyncEvaluation> {
  if (await shouldUseMemoryDb()) {
    return { shouldEnqueue: false, reason: "memory_db" };
  }

  const { dateKey, force } = input;

  if (force) {
    return { shouldEnqueue: true, reason: "force" };
  }

  if (await isQueueBackpressureActive()) {
    return { shouldEnqueue: false, reason: "queue_backpressure" };
  }

  const openJob = await hasOpenSyncJob(dateKey);
  if (openJob) {
    return { shouldEnqueue: false, reason: "open_job" };
  }

  // Finished/awaiting scores must never be blocked by dead-letter cooldown or
  // scheduled-retry delays — results + prediction settlement depend on this.
  const staleCountEarly = await countStaleMatchesForDate(dateKey);
  if (staleCountEarly > 0) {
    return { shouldEnqueue: true, reason: "stale_scores" };
  }

  const retryJob = await hasRetryScheduledJob(dateKey);
  if (retryJob) {
    return { shouldEnqueue: false, reason: "retry_scheduled" };
  }

  if (await hasRecentDeadLetter(dateKey)) {
    return { shouldEnqueue: false, reason: "recent_dead_letter" };
  }

  const snapshot = await loadKandakatorSnapshot(dateKey);

  if (!snapshot || snapshot.matches.length === 0) {
    // Empty days must rediscover quickly — VictoryAPI often lags then fills in.
    // Keep this shorter than the default freshness window used for populated days.
    const emptyDiscoveryFreshnessMs = readEnvMs(
      "KANDAKATOR_EMPTY_DISCOVERY_FRESHNESS_MS",
      10 * 60 * 1000,
    );
    const completedDiscovery = await getLatestCompletedJob(dateKey);
    if (completedDiscovery?.lastVerifiedAt) {
      if (
        Date.now() - completedDiscovery.lastVerifiedAt.getTime() <
        emptyDiscoveryFreshnessMs
      ) {
        return { shouldEnqueue: false, reason: "recent_completed_fresh" };
      }
    }
    return { shouldEnqueue: true, reason: "discovery" };
  }

  if (await hasUnsettledPredictionsForDate(dateKey)) {
    return { shouldEnqueue: true, reason: "unsettled_predictions" };
  }

  if (await hasPartialScoresForDate(dateKey)) {
    return { shouldEnqueue: true, reason: "partial_scores" };
  }

  const urgency = classifySyncUrgency(dateKey, snapshot);

  if (urgency === "critical") {
    return { shouldEnqueue: true, reason: criticalLifecycleReason(snapshot) };
  }

  if (await needsPeriodicRediscovery(dateKey)) {
    const todayKey = tehranDateKey(new Date());
    const today = kandakatorDateFromKey(todayKey);
    const yesterdayKey = tehranDateKey(addDays(today, -1));
    const tomorrowKey = tehranDateKey(addDays(today, 1));
    const reason = [yesterdayKey, todayKey, tomorrowKey].includes(dateKey)
      ? "near_date_rediscovery"
      : "week_rediscovery";
    return { shouldEnqueue: true, reason };
  }

  if (urgency === "none") {
    const todayKey = tehranDateKey(new Date());
    if (dateKey > todayKey) {
      return { shouldEnqueue: false, reason: "future_far_scheduled" };
    }
    return { shouldEnqueue: false, reason: "all_settled" };
  }

  const completedJob = await getLatestCompletedJob(dateKey);
  if (completedJob?.lastVerifiedAt) {
    const withinFreshness = isWithinCompletedFreshness(
      dateKey,
      urgency,
      snapshot,
      completedJob.lastVerifiedAt,
    );
    if (withinFreshness) {
      return { shouldEnqueue: false, reason: "recent_completed_fresh" };
    }
  }

  if (urgency === "medium") {
    return { shouldEnqueue: true, reason: "upcoming_pre_kickoff" };
  }

  if (kandakatorNeedsApiRefresh(dateKey, snapshot)) {
    return { shouldEnqueue: true, reason: "lifecycle_refresh" };
  }

  const todayKey = tehranDateKey(new Date());
  if (dateKey > todayKey) {
    return { shouldEnqueue: false, reason: "future_far_scheduled" };
  }

  return { shouldEnqueue: false, reason: "all_settled" };
}
