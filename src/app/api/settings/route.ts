import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getSettings } from "@/server/services/settings-service";
import { PROFILE_AVATARS } from "@/shared/constants/settings";

export const GET = withAuth(async (userId) => {
  const settings = await getSettings(userId);
  if (!settings) return jsonOk({ error: "یافت نشد" }, 404);
  return jsonOk({ settings, avatars: PROFILE_AVATARS });
});
