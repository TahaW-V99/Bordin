import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { getTeamCompetitionDetailForUser } from "@/server/services/team-competition-user-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const competition = await getTeamCompetitionDetailForUser(id, session.userId);
    if (!competition) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    return NextResponse.json({ competition });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
