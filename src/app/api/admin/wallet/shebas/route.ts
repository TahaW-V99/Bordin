import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import { listPendingShebaForAdmin } from "@/server/services/cash-wallet-service";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const items = await listPendingShebaForAdmin();
    return NextResponse.json({ items });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 403 });
  }
}
