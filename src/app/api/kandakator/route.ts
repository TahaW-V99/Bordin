import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getKandakatorForDate } from "@/server/services/kandakator-service";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const kandakator = await getKandakatorForDate(session.userId, date ?? undefined);

  return NextResponse.json(
    { kandakator },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
