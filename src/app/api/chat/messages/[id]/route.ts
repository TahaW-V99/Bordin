import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { editOwnChatTextMessage } from "@/server/services/chat-social-service";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  body: z.string().max(500),
});

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    await editOwnChatTextMessage(session.userId, id, body.body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
