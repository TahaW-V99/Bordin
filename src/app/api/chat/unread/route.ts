import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getTotalChatUnreadCount } from "@/server/services/chat-unread-service";

export const GET = withAuth(async (userId) => {
  const unreadCount = await getTotalChatUnreadCount(userId);
  return jsonOk({ unreadCount });
});
