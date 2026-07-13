import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { requireAdmin } from "@/server/services/admin-service";
import {
  listAdminWatchPartyRooms,
  listUpcomingKandakatorMatchesForAdmin,
} from "@/server/services/watch-party-service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requireAdmin(session.userId);
    const [matches, rooms] = await Promise.all([
      listUpcomingKandakatorMatchesForAdmin(),
      listAdminWatchPartyRooms(),
    ]);
    return NextResponse.json({ matches, rooms });
  } catch (error) {
    const message = error instanceof Error ? error.message : "خطا";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
