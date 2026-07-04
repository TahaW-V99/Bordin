import { NextResponse } from "next/server";
import { clearSession } from "@/shared/lib/auth";

export async function POST() {
  await clearSession();
  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  await clearSession();
  const url = new URL(request.url);
  const redirectTo = url.searchParams.get("redirect") ?? "/login";
  return NextResponse.redirect(new URL(redirectTo, request.url));
}
