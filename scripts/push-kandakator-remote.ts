/**
 * Triggers kandakator tick on remote app(s): enqueue near dates, process queue,
 * refresh stale scores, settle predictions.
 * Used by GitHub Actions and: npm run push:kandakator:remote
 */

async function pushWithRetry(url: string, init: RequestInit, attempts = 4) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(90_000),
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

  for (const baseUrl of targets) {
    console.log(`\n→ Ticking ${baseUrl}`);

    const res = await pushWithRetry(`${baseUrl}/api/internal/kandakator/tick`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${pushToken}`,
        "X-Bordin-Sync-Source": "github-actions",
      },
      body: JSON.stringify({ source: "github-actions" }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      queueProcessed?: number;
      settlement?: { settled?: number };
      reconciliation?: { staleCount?: number; settledCount?: number; idRefreshCount?: number } | null;
    };
    if (!res.ok) {
      throw new Error(`Tick failed @ ${baseUrl}: ${data.error ?? res.statusText}`);
    }
    console.log(
      `  queue=${data.queueProcessed ?? 0}` +
        ` settled=${data.settlement?.settled ?? 0}` +
        ` stale=${data.reconciliation?.staleCount ?? "n/a"}` +
        ` idRefresh=${data.reconciliation?.idRefreshCount ?? "n/a"}` +
        ` @ ${baseUrl}`,
    );
  }
}

const isDirectRun = process.argv[1]?.replace(/\\/g, "/").includes("push-kandakator-remote");

if (isDirectRun) {
  pushKandakatorWeekRemote().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
