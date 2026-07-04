import { NextResponse } from "next/server";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { acceptTeamInvite } from "@/server/services/team-service";
import { TeamMembershipConflictError } from "@/shared/constants/teams";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(async (userId) => {
    try {
      const result = await acceptTeamInvite(userId, id);
      return jsonOk(result);
    } catch (error) {
      if (error instanceof TeamMembershipConflictError) {
        return NextResponse.json(
          {
            error: error.code,
            code: error.code,
            currentTeam: {
              id: error.currentTeamId,
              name: error.currentTeamName,
              isOwner: error.isOwner,
            },
          },
          { status: 409 },
        );
      }
      const message = getApiErrorMessage(error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  })(_request);
}
