import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { jsonCaughtError, readAllowFootballCredit } from "@/shared/lib/api-route";
import { runWithAssetPaymentContext } from "@/server/services/asset-payment-context";
import { joinCup } from "@/server/services/competition-service";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const allowFootballCredit = await readAllowFootballCredit(request);
    await runWithAssetPaymentContext(allowFootballCredit, () => joinCup(id, session.userId));
    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonCaughtError(error);
  }
}
