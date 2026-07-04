import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { listMentionCandidates } from "@/server/services/chat-social-service";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const room = searchParams.get("room");
    const q = searchParams.get("q") ?? undefined;
    if (!room) {
      return NextResponse.json({ error: "اتاق چت نامعتبر است" }, { status: 400 });
    }

    const participants = await listMentionCandidates(session.userId, room, q);
    return NextResponse.json({ participants });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
