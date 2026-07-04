const SCROLL_RESTORE_KEY = "bordin:public-profile-scroll";

export function saveScrollPosition() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    SCROLL_RESTORE_KEY,
    JSON.stringify({
      path: `${window.location.pathname}${window.location.search}`,
      y: window.scrollY,
    }),
  );
}

export function restoreScrollPosition() {
  if (typeof window === "undefined") return;
  const raw = sessionStorage.getItem(SCROLL_RESTORE_KEY);
  if (!raw) return;
  sessionStorage.removeItem(SCROLL_RESTORE_KEY);
  try {
    const { path, y } = JSON.parse(raw) as { path: string; y: number };
    const current = `${window.location.pathname}${window.location.search}`;
    if (current !== path) return;
    requestAnimationFrame(() => {
      window.scrollTo({ top: y, behavior: "auto" });
    });
  } catch {
    // ignore malformed storage
  }
}

export function buildPublicProfileUrl(slug: string, origin?: string) {
  const base = origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/showcase/${slug}`;
}
