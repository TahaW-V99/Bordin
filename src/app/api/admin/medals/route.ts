import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import { listAdminMedalsForPicker } from "@/server/services/admin-team-competition-service";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const medals = await listAdminMedalsForPicker();
    return NextResponse.json({ medals });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 403 });
  }
}
