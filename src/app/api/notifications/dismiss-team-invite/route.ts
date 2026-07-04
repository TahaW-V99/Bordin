import { z } from "zod";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import {
  dismissTeamInviteNotifications,
  getUnreadNotificationCount,
} from "@/server/services/notification-service";

const schema = z.object({ inviteId: z.string().min(1) });

export async function POST(request: Request) {
  return withAuth(async (userId) => {
    const { inviteId } = schema.parse(await request.json());
    await dismissTeamInviteNotifications(userId, inviteId);
    const unreadCount = await getUnreadNotificationCount(userId);
    return jsonOk({ success: true, unreadCount });
  })(request);
}
