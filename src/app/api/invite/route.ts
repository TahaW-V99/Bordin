import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { getInviteInfoForUser } from "@/server/services/invite-service";
import { resolveSocialShareOrigin } from "@/shared/lib/environment";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user =
      (await shouldUseMemoryDb())
        ? devMemoryDb.user.findById(session.userId)
        : await prisma.user.findUnique({
            where: { id: session.userId },
            select: { username: true },
          });

    const origin = resolveSocialShareOrigin(request);
    const info = await getInviteInfoForUser(session.userId, user?.username, origin);
    return NextResponse.json(info);
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
