import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { isStoreSellEnabled } from "@/shared/lib/environment";

export async function POST(request: Request) {
  void request;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isStoreSellEnabled()) {
    return NextResponse.json({ error: "فروش سکه غیرفعال است" }, { status: 403 });
  }
  return NextResponse.json({ error: "فروش سکه غیرفعال است" }, { status: 403 });
}
