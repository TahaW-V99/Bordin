import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { notifyOwnerToRegister } from "@/server/services/team-competition-user-service";

const schema = z.object({ teamId: z.string() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;
    const body = schema.parse(await request.json());
    const result = await notifyOwnerToRegister(session.userId, id, body.teamId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
