import type { SmsDeliveryResult, SmsProvider } from "@/server/services/sms/types";
import { normalizePhone } from "@/shared/lib/phone";

function logMockSms(phone: string, message: string) {
  console.log(`[Bordin SMS mock] ${normalizePhone(phone)}: ${message}`);
}

export const mockSmsProvider: SmsProvider = {
  id: "mock",

  async sendOtp(phone, code) {
    logMockSms(phone, `OTP ${code}`);
    return { sent: true, mock: true, provider: "mock" };
  },

  async sendTransactional(phone, message) {
    logMockSms(phone, message);
    return { sent: true, mock: true, provider: "mock" };
  },
};

export function mockSmsResult(): SmsDeliveryResult {
  return { sent: true, mock: true, provider: "mock" };
}
