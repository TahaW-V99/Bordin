import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { rejectTeamInvite } from "@/server/services/team-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(async (userId) => {
    const result = await rejectTeamInvite(userId, id);
    return jsonOk(result);
  })(_request);
}
