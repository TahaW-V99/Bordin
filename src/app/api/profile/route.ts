import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getFullProfile } from "@/server/services/profile-service";

export const GET = withAuth(async (userId) => {
  const profile = await getFullProfile(userId);
  if (!profile) return jsonOk({ error: "یافت نشد" }, 404);
  return jsonOk({ profile });
});
