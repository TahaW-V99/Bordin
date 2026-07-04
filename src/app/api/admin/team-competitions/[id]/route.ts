import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import {
  deleteAdminTeamCompetition,
  getAdminTeamCompetition,
  updateAdminTeamCompetition,
} from "@/server/services/admin-team-competition-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const { id } = await params;
    const competition = await getAdminTeamCompetition(id);
    return NextResponse.json({ competition });
  } catch (error) {
    const message = getApiErrorMessage(error);
    const status = message.includes("یافت نشد") ? 404 : 403;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const { id } = await params;
    const body = await request.json();
    const competition = await updateAdminTeamCompetition(id, body);
    return NextResponse.json({ competition });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const { id } = await params;
    const result = await deleteAdminTeamCompetition(id);
    return NextResponse.json(result);
  } catch (error) {
    const message = getApiErrorMessage(error);
    const status = message.includes("یافت نشد") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
