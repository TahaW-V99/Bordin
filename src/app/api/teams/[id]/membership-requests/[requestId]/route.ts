import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { respondToMembershipRequest } from "@/server/services/team-service";
import { TeamMembershipConflictError } from "@/shared/constants/teams";

const bodySchema = z.object({ accept: z.boolean() });

type Params = { params: Promise<{ id: string; requestId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { requestId } = await params;
    const body = bodySchema.parse(await request.json());
    const result = await respondToMembershipRequest(requestId, session.userId, body.accept);
    return NextResponse.json(result);
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
    const status = message.includes("ظرفیت") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
