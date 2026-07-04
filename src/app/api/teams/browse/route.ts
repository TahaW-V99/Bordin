import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { browseTeamsForCompetition } from "@/server/services/team-service";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const url = new URL(request.url);
    const competitionId = url.searchParams.get("competitionId");
    if (!competitionId) {
      return NextResponse.json({ error: "competitionId الزامی است" }, { status: 400 });
    }
    const filter = url.searchParams.get("filter") === "open" ? "open" : "all";
    const teams = await browseTeamsForCompetition(competitionId, filter);
    return NextResponse.json({ teams });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
