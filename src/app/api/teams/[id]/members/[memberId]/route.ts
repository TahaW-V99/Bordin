import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { removeTeamMember } from "@/server/services/team-service";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  const { id, memberId } = await params;
  return withAuth(async (userId) => {
    const result = await removeTeamMember(userId, id, memberId);
    return jsonOk(result);
  })(_request);
}
