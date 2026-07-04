import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { sellByPackage } from "@/server/services/store-service";

const schema = z.object({ amount: z.number().int().positive() });

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { amount } = schema.parse(await request.json());
    const result = await sellByPackage(session.userId, amount);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
