import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { inviteUsersToWatchParty } from "@/server/services/watch-party-service";

const inviteSchema = z.object({
  roomId: z.string().min(1),
  inviteeIds: z.array(z.string().min(1)).min(1),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = inviteSchema.parse(await request.json());
    const result = await inviteUsersToWatchParty(
      session.userId,
      body.roomId,
      body.inviteeIds,
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "خطا";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
