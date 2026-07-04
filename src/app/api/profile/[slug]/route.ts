import { NextResponse } from "next/server";
import { getPublicProfile } from "@/server/services/profile-service";
import { getApiErrorMessage } from "@/shared/lib/api-errors";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const profile = await getPublicProfile(slug);
    if (!profile) return NextResponse.json({ error: "یافت نشد" }, { status: 404 });
    return NextResponse.json({ profile });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
