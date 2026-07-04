import { NextResponse } from "next/server";
import { z } from "zod";
import { invalidateOtp } from "@/server/services/auth-service";
import { getClientIp } from "@/server/services/auth-audit";
import { getApiErrorMessage } from "@/shared/lib/api-errors";

const schema = z.object({
  phone: z.string().min(10, "شماره موبایل الزامی است"),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = schema.parse(body);
    await invalidateOtp(phone, getClientIp(request));
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: getApiErrorMessage(error) },
      { status: 400 },
    );
  }
}
