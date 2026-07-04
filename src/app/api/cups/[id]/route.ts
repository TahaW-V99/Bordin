import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { getCup } from "@/server/services/competition-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const cup = await getCup(id, session.userId);
    if (!cup) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    return NextResponse.json({ cup });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
