import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin, listAdminCups } from "@/server/services/admin-service";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const cups = await listAdminCups();
    return NextResponse.json({ cups });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 403 });
  }
}
