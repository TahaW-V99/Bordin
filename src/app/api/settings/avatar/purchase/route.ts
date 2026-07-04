import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { purchaseAvatar } from "@/server/services/settings-service";

export const POST = withAuth(async (userId, request) => {
  const body = (await request.json()) as { avatarId?: string };
  if (!body.avatarId) {
    return jsonOk({ error: "آواتار الزامی است" }, 400);
  }
  const result = await purchaseAvatar(userId, body.avatarId);
  return jsonOk({ success: true, ...result });
});
