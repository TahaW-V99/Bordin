import { isPaymentGatewayMockMode } from "@/server/services/payment-gateway";

const ZIBAL_API_BASE = "https://gateway.zibal.ir";
const ZIBAL_TEST_MERCHANT = "zibal";

const ZIBAL_ERROR_FA: Record<number, string> = {
  102: "مرچنت یافت نشد.",
  103: "مرچنت غیرفعال است.",
  104: "مرچنت نامعتبر است.",
  105: "مبلغ باید بیشتر از ۱۰۰۰ ریال باشد.",
  106: "callbackUrl نامعتبر است.",
  113: "مبلغ تراکنش با مبلغ پرداخت‌شده مطابقت ندارد.",
  201: "تراکنش قبلاً تأیید شده است.",
  202: "تراکنش ناموفق یا لغو شده است.",
  203: "trackId نامعتبر است.",
};

type ZibalRequestResponse = {
  result?: number;
  message?: string;
  trackId?: number | string;
};

type ZibalVerifyResponse = {
  result?: number;
  message?: string;
  paidAt?: string;
  amount?: number;
  refNumber?: number | string;
  cardNumber?: string;
  status?: number;
  orderId?: string;
};

export function getZibalMerchantId() {
  if (isPaymentGatewayMockMode()) {
    return process.env.ZIBAL_MERCHANT_ID?.trim() || ZIBAL_TEST_MERCHANT;
  }
  const id = process.env.ZIBAL_MERCHANT_ID?.trim();
  if (!id) throw new Error("ZIBAL_MERCHANT_ID تنظیم نشده است");
  return id;
}

export function tomanToRials(amountToman: number) {
  return Math.round(amountToman * 10);
}

export function getZibalStartUrl(trackId: string | number) {
  return `${ZIBAL_API_BASE}/start/${trackId}`;
}

function translateZibalError(result: number | undefined, fallback?: string) {
  if (result != null && ZIBAL_ERROR_FA[result]) return ZIBAL_ERROR_FA[result];
  return fallback ?? `خطای زیبال (کد ${result ?? "نامشخص"})`;
}

export function isZibalRequestSuccess(json: ZibalRequestResponse | null) {
  return json?.result === 100 && json.trackId != null;
}

export function isZibalVerifySuccess(json: ZibalVerifyResponse | null) {
  const code = json?.result;
  return code === 100 || code === 201;
}

async function postZibal<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${ZIBAL_API_BASE}/${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });

  const json = (await response.json().catch(() => null)) as T | null;
  if (!json) {
    throw new Error(`خطا در ارتباط با زیبال (${response.status})`);
  }
  return json;
}

export async function createZibalPaymentRequest(input: {
  amountToman: number;
  callbackUrl: string;
  description: string;
  orderId: string;
  mobile?: string;
}) {
  const amountRials = tomanToRials(input.amountToman);
  const merchant = getZibalMerchantId();

  if (isPaymentGatewayMockMode()) {
    const trackId = `mock-${input.orderId}-${Date.now()}`;
    return {
      trackId,
      amountRials,
      merchantId: merchant,
      startPayUrl: `/store/payment/gateway?paymentId=${input.orderId}`,
      raw: { result: 100, trackId, mock: true },
    };
  }

  const json = await postZibal<ZibalRequestResponse>("v1/request", {
    merchant,
    amount: amountRials,
    callbackUrl: input.callbackUrl,
    description: input.description,
    orderId: input.orderId,
    ...(input.mobile ? { mobile: input.mobile } : {}),
  });

  if (!isZibalRequestSuccess(json)) {
    throw new Error(translateZibalError(json.result, json.message));
  }

  const trackId = String(json.trackId);
  return {
    trackId,
    amountRials,
    merchantId: merchant,
    startPayUrl: getZibalStartUrl(trackId),
    raw: json,
  };
}

export async function verifyZibalPayment(input: {
  trackId: string;
  expectedAmountRials: number;
  mockOutcome?: "success" | "failed";
}) {
  const merchant = getZibalMerchantId();

  if (isPaymentGatewayMockMode()) {
    if (input.mockOutcome === "failed") {
      return {
        verified: false as const,
        resultCode: 202,
        raw: { result: 202, mock: true },
        errorMessage: "پرداخت ناموفق (حالت تست)",
      };
    }
    return {
      verified: true as const,
      resultCode: 100,
      refNumber: `mock-ref-${input.trackId}`,
      paidAmountRials: input.expectedAmountRials,
      raw: { result: 100, refNumber: `mock-ref-${input.trackId}`, mock: true },
    };
  }

  const json = await postZibal<ZibalVerifyResponse>("v1/verify", {
    merchant,
    trackId: Number(input.trackId) || input.trackId,
  });

  if (!isZibalVerifySuccess(json)) {
    return {
      verified: false as const,
      resultCode: json.result ?? -1,
      raw: json,
      errorMessage: translateZibalError(json.result, json.message),
    };
  }

  if (json.amount != null && json.amount !== input.expectedAmountRials) {
    return {
      verified: false as const,
      resultCode: 113,
      raw: json,
      errorMessage: ZIBAL_ERROR_FA[113],
    };
  }

  return {
    verified: true as const,
    resultCode: json.result ?? 100,
    refNumber: json.refNumber != null ? String(json.refNumber) : null,
    paidAmountRials: json.amount ?? input.expectedAmountRials,
    raw: json,
  };
}
