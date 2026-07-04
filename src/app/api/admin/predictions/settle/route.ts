import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { requireAdmin } from "@/server/services/admin-service";
import { settleAllFinishedMatches } from "@/server/services/settlement-service";
import { getApiErrorMessage } from "@/shared/lib/api-errors";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);

    const result = await settleAllFinishedMatches();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
