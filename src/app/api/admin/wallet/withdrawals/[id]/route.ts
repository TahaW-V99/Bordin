import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import {
  adminApproveWithdrawal,
  adminRejectWithdrawal,
} from "@/server/services/cash-wallet-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const { id } = await params;
    const body = (await request.json()) as { action?: string };

    if (body.action === "approve") {
      const result = await adminApproveWithdrawal(id);
      return NextResponse.json({ result });
    }
    if (body.action === "reject") {
      const result = await adminRejectWithdrawal(id);
      return NextResponse.json({ result });
    }

    return NextResponse.json({ error: "عملیات نامعتبر" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
