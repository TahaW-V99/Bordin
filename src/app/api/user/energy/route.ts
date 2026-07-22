import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getUserEnergyView } from "@/server/services/energy-service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const energy = await getUserEnergyView(session.userId);
  return NextResponse.json({ energy });
}
