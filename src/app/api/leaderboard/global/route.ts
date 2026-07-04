import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getGlobalLeaderboardForUser } from "@/server/services/leaderboard-service";

export const GET = withAuth(async (userId) => {
  const data = await getGlobalLeaderboardForUser(userId);
  return jsonOk(data);
});
