import { NextResponse } from "next/server";
import { prisma } from "@/shared/lib/prisma";
import { getSmsIrConfig } from "@/server/config/sms-config";

export async function GET(request: Request) {
  const warm = new URL(request.url).searchParams.get("warm") === "1";
  if (warm) {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      // Warmup is best-effort only.
    }

    try {
      const config = getSmsIrConfig();
      if (config.apiKey) {
        void fetch(`${config.baseUrl}/credit`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            "x-api-key": config.apiKey,
          },
          signal: AbortSignal.timeout(2500),
        });
      }
    } catch {
      // Warmup is best-effort only.
    }
  }

  return NextResponse.json({ status: "ok", app: "bordin" });
}
