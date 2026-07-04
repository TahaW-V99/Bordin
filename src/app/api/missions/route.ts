import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getMissionsForUser } from "@/server/services/mission-service";

export const GET = withAuth(async (userId) => {
  const missions = await getMissionsForUser(userId);
  return jsonOk({ missions });
});
