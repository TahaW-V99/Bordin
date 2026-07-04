import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import {
  createAdminTeamCompetition,
  listAdminTeamCompetitions,
} from "@/server/services/admin-team-competition-service";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const competitions = await listAdminTeamCompetitions();
    return NextResponse.json({ competitions });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 403 });
  }
}

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const body = await request.json();
    const competition = await createAdminTeamCompetition(body);
    return NextResponse.json({ competition }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
