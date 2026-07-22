import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import type { Prisma } from "@prisma/client";
import type { MatchLifecycleState, PredictionCategory } from "@/shared/lib/match-lifecycle";

type EventCategory = "match_status" | "prediction_category" | "sync" | "reconcile" | "fixture_score";

async function persistEvent(category: EventCategory, entityId: string | null, payload: Prisma.InputJsonValue) {
  if (await shouldUseMemoryDb()) return;

  try {
    await prisma.systemEventLog.create({
      data: {
        category,
        entityId,
        payload,
      },
    });
  } catch (error) {
    console.error("[Bordin:lifecycle] failed to persist event log:", error);
  }
}

function logStructured(category: string, payload: Record<string, unknown>) {
  console.info(`[Bordin:${category}]`, JSON.stringify({ ts: new Date().toISOString(), ...payload }));
}

export async function logMatchStatusChange(input: {
  matchId: string;
  previousStatus: string | null;
  newStatus: string;
  homeScore: number | null;
  awayScore: number | null;
  source: string;
}) {
  const payload = {
    matchId: input.matchId,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    source: input.source,
  };

  logStructured("match-lifecycle", { event: "match_status_change", ...payload });
  await persistEvent("match_status", input.matchId, payload as Prisma.InputJsonValue);
}

export async function logPredictionCategoryChange(input: {
  predictionId: string;
  userId: string;
  previousCategory: PredictionCategory;
  newCategory: PredictionCategory;
  matchId: string;
  source: string;
}) {
  if (input.previousCategory === input.newCategory) return;

  const payload = {
    predictionId: input.predictionId,
    userId: input.userId,
    matchId: input.matchId,
    previousCategory: input.previousCategory,
    newCategory: input.newCategory,
    source: input.source,
  };

  logStructured("match-lifecycle", { event: "prediction_category_change", ...payload });
  await persistEvent("prediction_category", input.predictionId, payload as Prisma.InputJsonValue);
}

export async function logSyncEvent(input: {
  scope: string;
  status: "success" | "partial" | "failed";
  source: string;
  matchCount?: number;
  settledCount?: number;
  staleCount?: number;
  orphanCount?: number;
  durationMs?: number;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  const payload = { event: "sync", ...input } as Prisma.InputJsonValue;
  logStructured("sync", input as Record<string, unknown>);
  await persistEvent("sync", input.scope, payload);
}

export async function logReconcileEvent(input: {
  staleCount: number;
  orphanCount: number;
  unsettledCount: number;
  partialScoreCount: number;
  datesTriggered: string[];
  settledCount: number;
  idRefreshCount?: number;
  durationMs: number;
  status: "success" | "partial" | "failed";
  errorMessage?: string;
}) {
  const payload = { event: "reconcile", ...input };
  logStructured("reconcile", payload);
  await persistEvent("reconcile", "global", payload as Prisma.InputJsonValue);
}

export async function logFixtureScoreViolation(input: {
  matchId: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  lifecycleState: MatchLifecycleState;
  source: string;
}) {
  const payload = { event: "fixture_score_violation", ...input };
  logStructured("fixture-score", payload);
  await persistEvent("fixture_score", input.matchId, payload as Prisma.InputJsonValue);
}
