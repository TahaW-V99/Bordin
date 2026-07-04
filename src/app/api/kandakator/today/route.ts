import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getKandakatorForDate } from "@/server/services/kandakator-service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const kandakator = await getKandakatorForDate(session.userId);
  return NextResponse.json(
    { kandakator },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
