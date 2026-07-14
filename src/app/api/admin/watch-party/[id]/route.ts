import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { requireAdmin } from "@/server/services/admin-service";
import {
  deleteWatchPartyRoom,
  updateWatchPartyRoom,
} from "@/server/services/watch-party-service";

const patchSchema = z.object({
  googleMeetUrl: z.string().min(1).optional(),
  capacity: z.number().int().positive().max(500).optional(),
  entryFeeCoins: z.number().int().min(0).optional(),
  buttonForceActive: z.boolean().optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireAdmin(session.userId);
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const room = await updateWatchPartyRoom(id, body);
    return NextResponse.json({ room });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "داده نامعتبر" }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "خطا";
    const status = message.includes("دسترسی") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireAdmin(session.userId);
    const { id } = await context.params;
    const result = await deleteWatchPartyRoom(id);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطا";
    const status = message.includes("دسترسی") ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
