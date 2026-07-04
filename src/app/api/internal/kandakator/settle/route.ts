import { NextResponse } from "next/server";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { settleAllFinishedMatches } from "@/server/services/settlement-service";

function authorizeSettle(request: Request) {
  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

export async function POST(request: Request) {
  try {
    if (!authorizeSettle(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    void request;
    const result = await settleAllFinishedMatches();
    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
