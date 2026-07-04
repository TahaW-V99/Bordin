import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { sharePredictionResultToRoom } from "@/server/services/chat-social-service";

const schema = z.object({
  predictionId: z.string().min(1),
  roomSlug: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = schema.parse(await request.json());
    const created = await sharePredictionResultToRoom(
      session.userId,
      body.predictionId,
      body.roomSlug,
    );

    const { getChatRoomDetail } = await import("@/server/services/chat-service");
    const detail = await getChatRoomDetail(session.userId, body.roomSlug);
    const message = detail?.messages.find((m) => m.id === created.id);

    return NextResponse.json({
      message,
      roomSlug: body.roomSlug,
    });
  } catch (error) {
    const message = getApiErrorMessage(error);
    const status = message.includes("دسترسی") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
