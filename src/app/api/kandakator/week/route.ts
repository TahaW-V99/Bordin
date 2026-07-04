import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getTehranWeekDays } from "@/server/services/kandakator-service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ days: getTehranWeekDays() });
}
