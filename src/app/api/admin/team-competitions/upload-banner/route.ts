import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { requireAdmin } from "@/server/services/admin-service";
import { saveTeamCompetitionBannerAsset } from "@/server/services/team-competition-banner-service";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BANNER_WIDTH = 156;
const BANNER_HEIGHT = 193;
const BANNER_SIZE_ERROR = "سایز تصویر مجاز نیست.";

function readImageDimensions(
  buffer: Buffer,
  type: string,
): { width: number; height: number } | null {
  if (type === "image/png" && buffer.length >= 24) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (type === "image/jpeg" && buffer.length >= 4) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
        };
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2) break;
      offset += 2 + segmentLength;
    }
  }
  if (type === "image/webp" && buffer.length >= 30 && buffer.toString("ascii", 0, 4) === "RIFF") {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8 ") {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
      };
    }
    if (chunk === "VP8L" && buffer.length >= 25) {
      const bits = buffer.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X" && buffer.length >= 30) {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3),
      };
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(session.userId);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "فایل بنر الزامی است" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "فرمت تصویر مجاز نیست (JPG, PNG, WEBP)" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "حداکثر حجم بنر ۲ مگابایت است" }, { status: 400 });
    }

    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads", "team-competition-banners");
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    const dimensions = readImageDimensions(buffer, file.type);
    if (
      !dimensions ||
      dimensions.width !== BANNER_WIDTH ||
      dimensions.height !== BANNER_HEIGHT
    ) {
      return NextResponse.json({ error: BANNER_SIZE_ERROR }, { status: 400 });
    }
    await writeFile(path.join(dir, filename), buffer);
    await saveTeamCompetitionBannerAsset(filename, file.type, buffer);

    return NextResponse.json({
      bannerUrl: `/api/team-competition-banners/${filename}`,
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
