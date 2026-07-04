import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { getTeamDetail } from "@/server/services/team-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const team = await getTeamDetail(session.userId, id);
    return NextResponse.json({ team });
  } catch (error) {
    const message = getApiErrorMessage(error);
    return NextResponse.json({ error: message }, { status: message.includes("یافت نشد") ? 404 : 400 });
  }
}
