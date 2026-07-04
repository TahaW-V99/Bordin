const CHAT_SCROLL_KEY = "bordin:chat-room-scroll";

export function saveChatRoomScroll(slug: string, scrollTop: number) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(
    CHAT_SCROLL_KEY,
    JSON.stringify({ slug, scrollTop, at: Date.now() }),
  );
}

export function restoreChatRoomScroll(slug: string, container: HTMLElement | null) {
  if (typeof window === "undefined" || !container) return;
  const raw = sessionStorage.getItem(CHAT_SCROLL_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { slug: string; scrollTop: number };
    if (parsed.slug !== slug) return;
    sessionStorage.removeItem(CHAT_SCROLL_KEY);
    requestAnimationFrame(() => {
      container.scrollTop = parsed.scrollTop;
    });
  } catch {
    // ignore
  }
}
