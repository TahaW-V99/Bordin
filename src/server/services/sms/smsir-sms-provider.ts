import {
  assertSmsIrApiConfig,
  getSmsIrOtpTemplate,
} from "@/server/config/sms-config";
import type {
  SmsDeliveryResult,
  SmsOtpTemplateKey,
  SmsProvider,
  SmsTemplatePayload,
} from "@/server/services/sms/types";
import { normalizePhone } from "@/shared/lib/phone";

type SmsIrApiResponse = {
  status?: number;
  message?: string;
  data?: { messageId?: number; cost?: number } | unknown;
};

function maskPhone(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.length < 7) return "***";
  return `${normalized.slice(0, 4)}***${normalized.slice(-3)}`;
}

/** SMS.ir verify API expects mobile without leading zero (e.g. 9120000000). */
function toSmsIrMobile(phone: string) {
  const normalized = normalizePhone(phone);
  if (normalized.startsWith("09") && normalized.length === 11) {
    return normalized.slice(1);
  }
  return normalized;
}

function logSmsIrFailure(context: string, details: Record<string, unknown>) {
  console.error(`[Bordin SMS.ir] ${context}`, details);
}

async function parseSmsIrResponse(response: Response): Promise<SmsIrApiResponse | null> {
  try {
    return (await response.json()) as SmsIrApiResponse;
  } catch {
    return null;
  }
}

async function postSmsIr(path: string, body: unknown, timeoutMs: number, apiKey: string, baseUrl: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const payload = await parseSmsIrResponse(response);
    return { response, payload };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("SMS.ir request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendVerifyTemplate(
  phone: string,
  template: SmsTemplatePayload,
  errorLabel: string,
): Promise<SmsDeliveryResult> {
  const config = assertSmsIrApiConfig();
  const mobile = toSmsIrMobile(phone);

  let response: Response;
  let payload: SmsIrApiResponse | null;

  try {
    ({ response, payload } = await postSmsIr(
      "/send/verify",
      {
        mobile,
        templateId: template.templateId,
        parameters: template.parameters,
      },
      config.timeoutMs,
      config.apiKey!,
      config.baseUrl,
    ));
  } catch (error) {
    logSmsIrFailure(`${errorLabel} network error`, {
      phone: maskPhone(phone),
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return { sent: false, mock: false, provider: "smsir" };
  }

  if (!response.ok || payload?.status !== 1) {
    logSmsIrFailure(`${errorLabel} delivery rejected`, {
      phone: maskPhone(phone),
      httpStatus: response.status,
      apiStatus: payload?.status ?? null,
      apiMessage: payload?.message ?? null,
    });
    return { sent: false, mock: false, provider: "smsir" };
  }

  const messageId =
    payload.data && typeof payload.data === "object" && payload.data !== null
      ? (payload.data as { messageId?: number }).messageId
      : undefined;

  return { sent: true, mock: false, provider: "smsir", messageId };
}

async function sendVerifyCode(
  phone: string,
  code: string,
  template: SmsOtpTemplateKey = "login",
): Promise<SmsDeliveryResult> {
  return sendVerifyTemplate(phone, getSmsIrOtpTemplate(template, code), "OTP");
}

export const smsIrProvider: SmsProvider = {
  id: "smsir",

  async sendOtp(phone, code, template) {
    return sendVerifyCode(phone, code, template);
  },

  async sendTransactional(phone, message, template) {
    if (template) {
      return sendVerifyTemplate(phone, template, "Transactional SMS");
    }

    logSmsIrFailure("Transactional SMS skipped (template not configured)", {
      phone: maskPhone(phone),
      messageLength: message.length,
    });
    return { sent: false, mock: false, provider: "smsir" };
  },
};
