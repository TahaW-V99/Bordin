import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { jsonCaughtError, readAllowFootballCredit } from "@/shared/lib/api-route";
import { runWithAssetPaymentContext } from "@/server/services/asset-payment-context";
import { registerTeamInCompetition } from "@/server/services/team-competition-user-service";

const schema = z.object({
  teamId: z.string(),
  ownerCoversShortfall: z.boolean().optional(),
  notifyMembers: z.boolean().optional(),
  allowFootballCredit: z.boolean().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const allowFootballCredit = await readAllowFootballCredit(request);
    const body = schema.parse(await request.json());
    const result = await runWithAssetPaymentContext(allowFootballCredit, () =>
      registerTeamInCompetition(session.userId, id, body.teamId, {
        ownerCoversShortfall: body.ownerCoversShortfall,
        notifyMembers: body.notifyMembers,
      }),
    );
    return NextResponse.json(result);
  } catch (error) {
    return jsonCaughtError(error);
  }
}
