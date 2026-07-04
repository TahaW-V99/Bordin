import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOtpAndLogin } from "@/server/services/auth-service";
import { getClientIp } from "@/server/services/auth-audit";
import { getApiErrorMessage } from "@/shared/lib/api-errors";

const schema = z.object({
  phone: z.string().min(10),
  code: z.string().length(6, "کد ۶ رقمی الزامی است"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const result = await verifyOtpAndLogin(
      data.phone,
      data.code,
      getClientIp(request),
    );

    return NextResponse.json({
      success: true,
      isNewUser: result.isNewUser,
      needsOnboarding: result.needsOnboarding,
    });
  } catch (error) {
    const message = getApiErrorMessage(error);
    const status = message.includes("پایگاه داده") ? 503 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
