import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { listChatRooms } from "@/server/services/chat-service";

export const GET = withAuth(async (userId) => {
  const rooms = await listChatRooms(userId);
  return jsonOk({ rooms });
});
