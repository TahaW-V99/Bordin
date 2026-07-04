import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { joinCup } from "@/server/services/competition-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    await joinCup(id, session.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
