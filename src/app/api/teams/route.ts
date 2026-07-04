import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { createTeam } from "@/server/services/competition-service";

const schema = z.object({ name: z.string().min(2).max(30) });

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { name } = schema.parse(await request.json());
    const team = await createTeam(session.userId, name);
    return NextResponse.json({ success: true, team });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
