import { NextResponse } from "next/server";
import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { footballCreditConfirmationResponse } from "@/server/services/asset-payment-response";
import { switchTeamViaInvite } from "@/server/services/team-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withAuth(async (userId) => {
    try {
      const result = await switchTeamViaInvite(userId, id);
      return jsonOk(result);
    } catch (error) {
      const confirm = footballCreditConfirmationResponse(error);
      if (confirm) return confirm;
      const message = getApiErrorMessage(error);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  })(_request);
}
