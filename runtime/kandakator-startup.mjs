const STARTUP_KEY = "__bordinKandakatorStartup";
const TICK_INTERVAL_MS = 60_000;
const INITIAL_DELAY_MS = 30_000;
const TICK_TIMEOUT_MS = 90_000;

function getBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  const port = process.env.PORT?.trim() || "3000";
  return `http://127.0.0.1:${port}`;
}

async function triggerTick() {
  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!token) return;

  try {
    const res = await fetch(`${getBaseUrl()}/api/internal/kandakator/tick`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ source: "instrumentation-startup" }),
      signal: AbortSignal.timeout(TICK_TIMEOUT_MS),
    });

    if (!res.ok) {
      if (res.status === 502 || res.status === 503) return;
      const text = await res.text().catch(() => "");
      console.error("[Bordin] kandakator tick failed:", res.status, text.slice(0, 200));
    }
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") return;
    console.error("[Bordin] kandakator startup tick error:", error);
  }
}

if (!globalThis[STARTUP_KEY]) {
  globalThis[STARTUP_KEY] = true;
  setTimeout(() => {
    void triggerTick();
    setInterval(() => {
      void triggerTick();
    }, TICK_INTERVAL_MS);
  }, INITIAL_DELAY_MS);
}
