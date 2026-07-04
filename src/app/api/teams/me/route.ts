import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { listUserTeams } from "@/server/services/team-service";

export const GET = withAuth(async (userId) => {
  const teams = await listUserTeams(userId);
  return jsonOk(teams);
});
