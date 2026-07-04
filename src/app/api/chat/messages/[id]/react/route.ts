import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { setChatReaction } from "@/server/services/chat-social-service";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  emoji: z.string().min(1).max(8),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = schema.parse(await request.json());
    const result = await setChatReaction(session.userId, id, body.emoji);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
