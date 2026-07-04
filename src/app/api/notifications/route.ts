import { withAuth, jsonOk } from "@/shared/lib/api-route";
import {
  getUnreadNotificationCount,
  getUnreadNotificationCountsByCategory,
  listUserNotifications,
} from "@/server/services/notification-service";
import { parseNotificationCategoryKey } from "@/shared/constants/notifications";

export const GET = withAuth(async (userId, request) => {
  const { searchParams } = new URL(request.url);
  const category = parseNotificationCategoryKey(searchParams.get("category"));
  const unreadOnly = searchParams.get("unread") === "1";

  if (unreadOnly) {
    const unreadCount = await getUnreadNotificationCount(userId);
    return jsonOk({ unreadCount });
  }

  const notifications = await listUserNotifications(userId, category);
  const unreadCount = await getUnreadNotificationCount(userId);
  const unreadByCategory = await getUnreadNotificationCountsByCategory(userId);
  return jsonOk({ notifications, unreadCount, unreadByCategory });
});
