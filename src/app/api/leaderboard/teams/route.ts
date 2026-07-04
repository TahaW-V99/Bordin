import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getTeamLeaderboard } from "@/server/services/team-leaderboard-service";

export const GET = withAuth(async () => {
  const leaderboard = await getTeamLeaderboard();
  return jsonOk({ leaderboard });
});
