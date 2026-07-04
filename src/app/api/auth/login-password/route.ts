import { NextResponse } from "next/server";
import { z } from "zod";
import { loginWithPassword } from "@/server/services/auth-service";
import { getClientIp } from "@/server/services/auth-audit";
import { getApiErrorMessage } from "@/shared/lib/api-errors";

const schema = z.object({
  phone: z.string().min(10),
  password: z.string().min(1, "رمز عبور الزامی است"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const data = schema.parse(body);
    const result = await loginWithPassword(
      data.phone,
      data.password,
      getClientIp(request),
    );

    return NextResponse.json({
      success: true,
      isNewUser: result.isNewUser,
      needsOnboarding: result.needsOnboarding,
    });
  } catch (error) {
    const message = getApiErrorMessage(error);
    const status = message.includes("پایگاه داده")
      ? 503
      : message.includes("قفل")
        ? 429
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
