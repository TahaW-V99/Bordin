import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage, isServerError } from "@/shared/lib/api-errors";

export function withAuth(
  handler: (userId: string, request: Request) => Promise<NextResponse>,
) {
  return async (request: Request) => {
    try {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return await handler(session.userId, request);
    } catch (error) {
      const message = getApiErrorMessage(error);
      const status = isServerError(error) ? 500 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
