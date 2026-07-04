import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { CHAT_DISPLAY_NAME_REQUIRED_ERROR } from "@/shared/constants/chat";
import {
  getChatRoomDetail,
  sendChatTextMessage,
} from "@/server/services/chat-service";
import { markChatRoomRead } from "@/server/services/chat-unread-service";

type Params = { params: Promise<{ slug: string }> };

const postSchema = z.object({
  body: z.string().max(500),
  replyToId: z.string().optional(),
});

export async function GET(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug } = await params;
    const { searchParams } = new URL(request.url);
    const beforeId = searchParams.get("beforeId") ?? undefined;

    const detail = await getChatRoomDetail(session.userId, slug, { beforeId });
    if (!detail) {
      return NextResponse.json({ error: "اتاق چت یافت نشد" }, { status: 404 });
    }

    if (detail.room.canAccess) {
      await markChatRoomRead(session.userId, slug);
    }

    return NextResponse.json(detail);
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { slug } = await params;
    const body = postSchema.parse(await request.json());
    const message = await sendChatTextMessage(
      session.userId,
      slug,
      body.body,
      body.replyToId,
    );
    return NextResponse.json({ message });
  } catch (error) {
    const message = getApiErrorMessage(error);
    if (message === CHAT_DISPLAY_NAME_REQUIRED_ERROR) {
      return NextResponse.json(
        { error: message, code: CHAT_DISPLAY_NAME_REQUIRED_ERROR },
        { status: 403 },
      );
    }
    const status = message.includes("دسترسی") || message.includes("عضو") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
