import { NextResponse } from "next/server";
import { z } from "zod";
import { resendOtp } from "@/server/services/auth-service";
import { getClientIp } from "@/server/services/auth-audit";
import { getApiErrorMessage } from "@/shared/lib/api-errors";

const schema = z.object({
  phone: z.string().min(10, "شماره موبایل الزامی است"),
  referralCode: z.string().max(64).optional(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone, referralCode } = schema.parse(body);
    const result = await resendOtp(phone, getClientIp(request), referralCode);
    return NextResponse.json({
      success: true,
      phone: result.phone,
      expiresAt: result.expiresAt,
      ...(result.mockCode ? { mockCode: result.mockCode } : {}),
    });
  } catch (error) {
    const message = getApiErrorMessage(error);
    const status = message.includes("پایگاه داده")
      ? 503
      : message.includes("بیش از حد")
        ? 429
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
