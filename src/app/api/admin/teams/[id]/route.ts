import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import { getAdminTeamDetail } from "@/server/services/admin-team-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const { id } = await params;
    const team = await getAdminTeamDetail(id);
    return NextResponse.json({ team });
  } catch (error) {
    const message = getApiErrorMessage(error);
    const status = message.includes("یافت نشد") ? 404 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}
