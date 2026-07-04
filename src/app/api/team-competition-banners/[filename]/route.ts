import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { loadTeamCompetitionBannerAsset } from "@/server/services/team-competition-banner-service";

type Params = { params: Promise<{ filename: string }> };

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export async function GET(_request: Request, { params }: Params) {
  const { filename } = await params;
  if (!filename || filename.includes("..") || filename.includes("/")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";

  const stored = await loadTeamCompetitionBannerAsset(filename);
  if (stored) {
    return new NextResponse(new Uint8Array(stored.data), {
      headers: {
        "Content-Type": stored.mimeType || contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  }

  const filePath = path.join(process.cwd(), "public", "uploads", "team-competition-banners", filename);
  try {
    const buffer = await readFile(filePath);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
