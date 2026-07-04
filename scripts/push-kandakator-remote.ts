/**
 * Enqueues kandakator week sync jobs on remote app(s).
 * Used by GitHub Actions and: npm run push:kandakator:remote
 */

async function pushWithRetry(url: string, init: RequestInit, attempts = 4) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(60_000),
      });
      return res;
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 3_000 * (i + 1)));
    }
  }
  throw lastError;
}

function resolvePushTargets(): string[] {
  const list =
    process.env.BORDIN_PUSH_URLS?.trim() ||
    process.env.BORDIN_STAGING_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "https://bordintest.ir,https://bordin.ir";

  return [...new Set(list.split(",").map((u) => u.trim().replace(/\/$/, "")).filter(Boolean))];
}

export async function pushKandakatorWeekRemote() {
  const pushToken = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!pushToken) {
    throw new Error("KANDAKATOR_SYNC_PUSH_TOKEN is not set");
  }

  const targets = resolvePushTargets();
  if (targets.length === 0) {
    throw new Error("No push target URL configured (BORDIN_PUSH_URLS / BORDIN_STAGING_URL)");
  }

  const { getTehranWeekDays } = await import("@/server/services/kandakator-service");

  const days = getTehranWeekDays();
  const dateKeys = days.map((day) => day.date);

  for (const baseUrl of targets) {
    console.log(`\n→ Enqueueing to ${baseUrl}`);

    const res = await pushWithRetry(`${baseUrl}/api/internal/kandakator/enqueue`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pushToken}`,
        "X-Bordin-Sync-Source": "github-actions",
      },
      body: JSON.stringify({ dates: dateKeys, source: "github-actions" }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      jobs?: Array<{ id: string; dateKey: string; status: string }>;
    };
    if (!res.ok) {
      throw new Error(`Queue enqueue failed @ ${baseUrl}: ${data.error ?? res.statusText}`);
    }
    console.log(`  Queued ${data.jobs?.length ?? 0} sync jobs @ ${baseUrl}`);
  }
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").includes("push-kandakator-remote");

if (isDirectRun) {
  pushKandakatorWeekRemote().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
