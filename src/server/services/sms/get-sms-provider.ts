import { getSmsProviderId } from "@/server/config/sms-config";
import { mockSmsProvider } from "@/server/services/sms/mock-sms-provider";
import { smsIrProvider } from "@/server/services/sms/smsir-sms-provider";
import type { SmsProvider } from "@/server/services/sms/types";

export function getSmsProvider(): SmsProvider {
  return getSmsProviderId() === "smsir" ? smsIrProvider : mockSmsProvider;
}
