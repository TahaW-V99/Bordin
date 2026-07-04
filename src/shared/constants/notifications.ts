export const WELCOME_NOTIFICATION_TITLE = "به بُردین خوش آمدید";

export const WELCOME_NOTIFICATION_BODY =
  "از این پس پیش‌بینی‌های روزانه، جام‌ها و تورنمنت‌ها را از همینجا دنبال کنید.";

export type NotificationCategoryKey = "message" | "announcement" | "discount";
export type NotificationUnreadByCategory = Record<NotificationCategoryKey, number>;

export const NOTIFICATION_FILTERS: Array<{
  key: NotificationCategoryKey;
  labelFa: string;
  category: "MESSAGE" | "ANNOUNCEMENT" | "DISCOUNT";
}> = [
  { key: "message", labelFa: "پیغام‌ها", category: "MESSAGE" },
  { key: "announcement", labelFa: "اطلاعیه‌ها", category: "ANNOUNCEMENT" },
  { key: "discount", labelFa: "تخفیف‌ها", category: "DISCOUNT" },
];

export const DEFAULT_NOTIFICATION_FILTER: NotificationCategoryKey = "message";

export function parseNotificationCategoryKey(
  value: string | null | undefined,
): NotificationCategoryKey {
  if (value === "announcement" || value === "discount") return value;
  return "message";
}

export function categoryKeyToEnum(key: NotificationCategoryKey) {
  return NOTIFICATION_FILTERS.find((f) => f.key === key)!.category;
}

export function emptyNotificationUnreadByCategory(): NotificationUnreadByCategory {
  return {
    message: 0,
    announcement: 0,
    discount: 0,
  };
}

export const NOTIFICATIONS_UPDATED_EVENT = "bordin:notifications-updated";
const UNREAD_COUNT_STORAGE_KEY = "bordin-unread-count";

export function dispatchNotificationsUpdated(unreadCount?: number) {
  if (typeof window === "undefined") return;
  if (typeof unreadCount === "number") {
    sessionStorage.setItem(UNREAD_COUNT_STORAGE_KEY, String(unreadCount));
  }
  window.dispatchEvent(
    new CustomEvent(NOTIFICATIONS_UPDATED_EVENT, { detail: { unreadCount } }),
  );
}

export function readStoredUnreadCount(): number | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(UNREAD_COUNT_STORAGE_KEY);
  if (raw === null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const MESSAGES_BACK_ROUTES = ["/home", "/profile"] as const;

export type MessagesBackRoute = (typeof MESSAGES_BACK_ROUTES)[number];

export function resolveMessagesBackHref(from: string | null | undefined): MessagesBackRoute {
  if (from === "profile" || from === "/profile" || from?.startsWith("/profile")) {
    return "/profile";
  }
  return "/home";
}

export function messagesHrefFromPathname(pathname: string) {
  const from = pathname.startsWith("/profile") ? "profile" : "home";
  return `/messages?from=${from}`;
}
