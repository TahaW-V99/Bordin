import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import {
  createDuelChallenge,
  listDuelOpponents,
} from "@/server/services/chat-social-service";

const schema = z.object({
  opponentId: z.string().min(1),
  matchIds: z.array(z.string().min(1)).min(1).max(5),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = schema.parse(await request.json());
    const created = await createDuelChallenge(session.userId, body);

    const { getChatRoomDetail } = await import("@/server/services/chat-service");
    const detail = await getChatRoomDetail(session.userId, "today-predictions");
    const message = detail?.messages.find((m) => m.id === created.id);

    return NextResponse.json({ message, roomSlug: "today-predictions" });
  } catch (error) {
    const message = getApiErrorMessage(error);
    const status = message.includes("دسترسی") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") ?? undefined;
    const opponents = await listDuelOpponents(session.userId, search);
    return NextResponse.json({ opponents });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
