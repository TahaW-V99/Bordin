import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { jsonCaughtError, readAllowFootballCredit } from "@/shared/lib/api-route";
import { runWithAssetPaymentContext } from "@/server/services/asset-payment-context";
import { createMembershipRequest } from "@/server/services/team-service";
import { TeamMembershipConflictError } from "@/shared/constants/teams";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const allowFootballCredit = await readAllowFootballCredit(request);
    const result = await runWithAssetPaymentContext(allowFootballCredit, () =>
      createMembershipRequest(session.userId, id),
    );
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
    return jsonCaughtError(error);
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
