import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import { toggleTeamCompetitionPublish } from "@/server/services/admin-team-competition-service";

const bodySchema = z.object({
  isPublished: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const competition = await toggleTeamCompetitionPublish(id, body.isPublished);
    return NextResponse.json({ competition });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
