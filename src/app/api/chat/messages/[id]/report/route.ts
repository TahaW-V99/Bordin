import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { reportChatMessage } from "@/server/services/chat-social-service";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  reason: z.string().max(500).optional(),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const body = schema.parse(await request.json().catch(() => ({})));
    const result = await reportChatMessage(session.userId, id, body.reason);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
