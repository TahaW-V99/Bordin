import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { jsonCaughtError } from "@/shared/lib/api-route";
import { getWheelStatus, spinWheel } from "@/server/services/wheel-service";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const status = await getWheelStatus(session.userId);
    return NextResponse.json(status);
  } catch (error) {
    return jsonCaughtError(error);
  }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const result = await spinWheel(session.userId);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return jsonCaughtError(error);
  }
}
