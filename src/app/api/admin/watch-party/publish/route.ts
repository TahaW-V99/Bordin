import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { requireAdmin } from "@/server/services/admin-service";
import { publishWatchPartyRooms } from "@/server/services/watch-party-service";

const publishSchema = z.object({
  rooms: z
    .array(
      z.object({
        matchId: z.string().min(1),
        googleMeetUrl: z.string().min(1),
        capacity: z.number().int().positive().max(500),
        entryFeeCoins: z.number().int().min(0),
      }),
    )
    .min(1),
});

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireAdmin(session.userId);
    const body = publishSchema.parse(await request.json());
    const rooms = await publishWatchPartyRooms(session.userId, body.rooms);
    return NextResponse.json({ rooms });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "خطا";
    const status = message.includes("دسترسی") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
