import { NextResponse } from "next/server";
import { getTeamShowcaseProfile } from "@/server/services/team-service";
import { getApiErrorMessage } from "@/shared/lib/api-errors";

type Params = { params: Promise<{ teamId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { teamId } = await params;
    const team = await getTeamShowcaseProfile(teamId);
    if (!team) {
      return NextResponse.json({ error: "تیم یافت نشد" }, { status: 404 });
    }
    return NextResponse.json({ team });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
