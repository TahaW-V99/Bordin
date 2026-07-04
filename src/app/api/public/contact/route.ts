import { NextResponse } from "next/server";
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(2, "نام باید حداقل ۲ کاراکتر باشد").max(100),
  email: z.string().trim().email("ایمیل معتبر نیست").max(200),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  subject: z.string().trim().min(3, "موضوع باید حداقل ۳ کاراکتر باشد").max(200),
  message: z.string().trim().min(10, "پیام باید حداقل ۱۰ کاراکتر باشد").max(5000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "اطلاعات نامعتبر است";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name, email, phone, subject, message } = parsed.data;

    console.log("[Bordin:contact]", {
      ts: new Date().toISOString(),
      name,
      email,
      phone: phone || null,
      subject,
      messageLength: message.length,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "درخواست نامعتبر است" }, { status: 400 });
  }
}
