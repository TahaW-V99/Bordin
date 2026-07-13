import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { listUsersForWatchPartyInvite } from "@/server/services/watch-party-service";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? undefined;
  const users = await listUsersForWatchPartyInvite(session.userId, q);
  return NextResponse.json({ users });
}
