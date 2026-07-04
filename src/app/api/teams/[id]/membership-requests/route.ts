import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { createMembershipRequest } from "@/server/services/team-service";
import { TeamMembershipConflictError } from "@/shared/constants/teams";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const result = await createMembershipRequest(session.userId, id);
    return NextResponse.json({
      request: result.request,
      teamName: result.teamName,
      feeCoins: result.feeCoins,
    });
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
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const { listPendingMembershipRequests } = await import("@/server/services/team-service");
    const requests = await listPendingMembershipRequests(id, session.userId);
    return NextResponse.json({ requests });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
