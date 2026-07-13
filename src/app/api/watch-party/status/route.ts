import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getWatchPartyStatusForUser } from "@/server/services/watch-party-service";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId");
  if (!matchId) {
    return NextResponse.json({ error: "matchId الزامی است" }, { status: 400 });
  }

  const status = await getWatchPartyStatusForUser(session.userId, matchId);
  return NextResponse.json({ status });
}
