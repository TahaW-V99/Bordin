import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { touchUserPresence } from "@/server/services/watch-party-service";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await touchUserPresence(session.userId);
  return NextResponse.json({ ok: true });
}
