import { isProductionEnvironment } from "@/shared/lib/environment";
import type {
  SmsOtpTemplateKey,
  SmsTemplateParameter,
  SmsTemplatePayload,
} from "@/server/services/sms/types";

export type SmsProviderId = "mock" | "smsir";

/**
 * SMS.ir OTP panel (login/settings codes).
 * Re-enable/disable: set SMS_PANEL_ENABLED in Liara env, or flip SMS_PANEL_ENABLED_DEFAULT.
 */
const SMS_PANEL_ENABLED_DEFAULT = true;

export function isSmsOtpPanelEnabled(): boolean {
  const env = process.env.SMS_PANEL_ENABLED?.trim().toLowerCase();
  if (env === "true" || env === "1") return true;
  if (env === "false" || env === "0") return false;
  return SMS_PANEL_ENABLED_DEFAULT;
}

/** True when OTP/SMS should not call external providers (staging, local dev). */
export function isSmsMockMode(): boolean {
  if (process.env.SMS_MOCK_MODE === "true") return true;
  if (!isProductionEnvironment()) return true;
  return false;
}

/** True when OTP should be fixed/mock (no SMS.ir verify call). */
export function shouldUseMockOtp(): boolean {
  return isSmsMockMode() || !isSmsOtpPanelEnabled();
}

/** Central SMS provider selection — driven by BORDIN_ENV + SMS_MOCK_MODE, not hostname checks. */
export function getSmsProviderId(): SmsProviderId {
  return isSmsMockMode() ? "mock" : "smsir";
}

export function getSmsIrOtpParameterNames(): string[] {
  const namesEnv = process.env.SMS_IR_OTP_PARAMETER_NAMES?.trim();
  if (namesEnv) {
    return namesEnv
      .split(/[,;\s]+/)
      .map((name) => name.trim())
      .filter(Boolean);
  }

  const legacy = process.env.SMS_IR_OTP_PARAMETER_NAME?.trim();
  if (legacy) return [legacy];

  return ["OTP", "CODE"];
}

export function buildSmsIrOtpParameters(code: string) {
  return getSmsIrOtpParameterNames().map((name) => ({ name, value: code }));
}

function parseTemplateId(raw: string | undefined) {
  const parsed = raw?.trim() ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function getSmsIrConfig() {
  const apiKey = process.env.SMS_IR_API_KEY?.trim();

  return {
    apiKey,
    loginOtpTemplateId: parseTemplateId(process.env.SMS_IR_OTP_TEMPLATE_ID),
    passwordResetTemplateId: 253180,
    shebaVerifiedTemplateId: 637983,
    withdrawalApprovedTemplateId: 933684,
    withdrawalAdminAlertTemplateId: 740206,
    parameterNames: getSmsIrOtpParameterNames(),
    baseUrl: process.env.SMS_IR_API_BASE_URL?.trim() || "https://api.sms.ir/v1",
    timeoutMs: Number.parseInt(process.env.SMS_IR_REQUEST_TIMEOUT_MS ?? "10000", 10) || 10_000,
  };
}

export function assertSmsIrApiConfig() {
  const config = getSmsIrConfig();
  if (!config.apiKey) {
    throw new Error("SMS_IR_API_KEY is not configured");
  }
  return config;
}

export function getSmsIrOtpTemplate(template: SmsOtpTemplateKey, code: string): SmsTemplatePayload {
  const config = assertSmsIrApiConfig();

  if (template === "password_reset") {
    return {
      templateId: config.passwordResetTemplateId,
      parameters: [{ name: "VERIFICATIONCODE", value: code }],
    };
  }

  if (!config.loginOtpTemplateId) {
    throw new Error("SMS_IR_OTP_TEMPLATE_ID is not configured");
  }

  return {
    templateId: config.loginOtpTemplateId,
    parameters: buildSmsIrOtpParameters(code),
  };
}

export function buildSmsIrTemplatePayload(
  template:
    | "sheba_verified"
    | "withdrawal_approved"
    | "withdrawal_admin_alert",
  fields: {
    name: string;
    amount?: string;
  },
): SmsTemplatePayload {
  const config = assertSmsIrApiConfig();

  switch (template) {
    case "sheba_verified":
      return {
        templateId: config.shebaVerifiedTemplateId,
        parameters: [{ name: "NAME", value: fields.name }],
      };
    case "withdrawal_approved":
      return {
        templateId: config.withdrawalApprovedTemplateId,
        parameters: [
          { name: "NAME", value: fields.name },
          { name: "AMOUNT", value: fields.amount ?? "" },
        ],
      };
    case "withdrawal_admin_alert":
      return {
        templateId: config.withdrawalAdminAlertTemplateId,
        parameters: [
          { name: "NAME", value: fields.name },
          { name: "AMOUNT", value: fields.amount ?? "" },
        ],
      };
  }
}
