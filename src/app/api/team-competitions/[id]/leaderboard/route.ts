import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import {
  getTeamCompetitionLeaderboard,
  getTeamCompetitionBracket,
} from "@/server/services/team-competition-user-service";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const view = new URL(request.url).searchParams.get("view");
    if (view === "bracket") {
      const bracket = await getTeamCompetitionBracket(id);
      return NextResponse.json({ bracket });
    }
    const leaderboard = await getTeamCompetitionLeaderboard(id, session.userId);
    return NextResponse.json({ leaderboard });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
