import { normalizePhone } from "@/shared/lib/phone";
import { validateShebaDigits } from "@/shared/lib/sheba";

export type ShebaInquiryResult = {
  matched: boolean;
  messageFa: string;
  ownerName?: string | null;
};

/**
 * استعلام مالکیت شبا نسبت به شماره تماس کاربر.
 * در حالت mock: اگر ۴ رقم آخر موبایل در شبا باشد یا SHEBA_INQUIRY_ALWAYS_MATCH=true تطابق برمی‌گردد.
 */
export async function inquireShebaOwnership(
  shebaDigits: string,
  userPhone: string,
): Promise<ShebaInquiryResult> {
  validateShebaDigits(shebaDigits);
  const phone = normalizePhone(userPhone);
  const last4 = phone.slice(-4);

  const forceMatch = process.env.SHEBA_INQUIRY_ALWAYS_MATCH === "true";
  const mockMode = process.env.SMS_MOCK_MODE === "true" || process.env.SHEBA_INQUIRY_MOCK === "true";
  const matched = forceMatch || (mockMode && shebaDigits.includes(last4));

  if (matched) {
    return {
      matched: true,
      messageFa: "مالک شماره شبا و شماره تماس یکسان است.",
      ownerName: null,
    };
  }

  if (mockMode) {
    return {
      matched: false,
      messageFa: "مالک شماره حساب و شماره تماس یکسان نیست.",
      ownerName: null,
    };
  }

  return {
    matched: false,
    messageFa:
      "سرویس استعلام شبا پیکربندی نشده است. برای تست SHEBA_INQUIRY_ALWAYS_MATCH=true را فعال کنید.",
    ownerName: null,
  };
}
