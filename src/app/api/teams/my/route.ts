import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { listMyTeams, getPendingInvitesReceived, getTeamDraft } from "@/server/services/team-service";

export const GET = withAuth(async (userId) => {
  const [teams, pendingInvites, draft] = await Promise.all([
    listMyTeams(userId),
    getPendingInvitesReceived(userId),
    getTeamDraft(userId),
  ]);
  return jsonOk({ teams, pendingInvites, draft });
});
