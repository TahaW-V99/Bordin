import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { joinWatchParty } from "@/server/services/watch-party-service";

const joinSchema = z.object({
  roomId: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = joinSchema.parse(await request.json());
    const result = await joinWatchParty(session.userId, body.roomId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "خطا";
    const status =
      message.includes("کافی نیست") || message.includes("تکمیل") ? 400 : 400;
    return NextResponse.json({ error: message, code: message }, { status });
  }
}
