const STARTUP_KEY = "__bordinKandakatorStartup";
const TICK_INTERVAL_MS = 60_000;
const INITIAL_DELAY_MS = 15_000;

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
      signal: AbortSignal.timeout(45_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[Bordin] kandakator tick failed:", res.status, text);
    }
  } catch (error) {
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
