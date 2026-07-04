import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import {
  getUnreadNotificationCount,
  markNotificationRead,
} from "@/server/services/notification-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const notification = await markNotificationRead(session.userId, id);
    const unreadCount = await getUnreadNotificationCount(session.userId);
    return NextResponse.json({ success: true, notification, unreadCount });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
