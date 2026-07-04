import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { listUsersForTeamInvite } from "@/server/services/team-service";

export const GET = withAuth(async (userId, request) => {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const teamId = searchParams.get("teamId") ?? undefined;
  const users = await listUsersForTeamInvite(userId, q, teamId);
  return jsonOk({ users });
});
