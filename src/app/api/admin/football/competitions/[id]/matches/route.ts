import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import { listAdminFootballMatchesByCompetition } from "@/server/services/admin-football-catalog-service";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const { id } = await params;
    const competitionId = Number(id);
    if (!Number.isFinite(competitionId)) {
      return NextResponse.json({ error: "شناسه لیگ نامعتبر است" }, { status: 400 });
    }
    const matches = await listAdminFootballMatchesByCompetition(competitionId);
    return NextResponse.json({ matches });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
