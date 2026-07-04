import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import { setTeamSuspended } from "@/server/services/admin-team-service";

const bodySchema = z.object({
  suspended: z.boolean(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const team = await setTeamSuspended(id, body.suspended);
    return NextResponse.json({ team });
  } catch (error) {
    const message = getApiErrorMessage(error);
    const status = message.includes("یافت نشد") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
