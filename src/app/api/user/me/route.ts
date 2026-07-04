import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getCurrentUser } from "@/server/services/user-service";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await getCurrentUser(session.userId);

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
