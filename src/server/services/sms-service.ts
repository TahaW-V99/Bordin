import { getSmsProvider } from "@/server/services/sms/get-sms-provider";
import type {
  SmsDeliveryResult,
  SmsOtpTemplateKey,
  SmsTemplatePayload,
} from "@/server/services/sms/types";
import { normalizePhone } from "@/shared/lib/phone";

const OTP_SMS_FAILURE_MESSAGE =
  "ارسال پیامک با خطا مواجه شد. لطفاً چند لحظه بعد دوباره تلاش کنید.";

/** Deliver login/settings OTP via the configured SMS provider (SMS.ir on production). */
export async function deliverOtpCode(
  phone: string,
  code: string,
  template: SmsOtpTemplateKey = "login",
): Promise<SmsDeliveryResult> {
  const provider = getSmsProvider();
  const result = await provider.sendOtp(normalizePhone(phone), code, template);
  if (!result.sent) {
    throw new Error(OTP_SMS_FAILURE_MESSAGE);
  }
  return result;
}

export async function sendTransactionalSms(
  phone: string,
  message: string,
  template?: SmsTemplatePayload,
) {
  const normalized = normalizePhone(phone);
  const provider = getSmsProvider();
  return provider.sendTransactional(normalized, message, template);
}
