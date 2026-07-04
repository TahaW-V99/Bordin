import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { listTeamChatRooms } from "@/server/services/chat-service";

export const GET = withAuth(async (userId) => {
  const rooms = await listTeamChatRooms(userId);
  return jsonOk({ rooms });
});
