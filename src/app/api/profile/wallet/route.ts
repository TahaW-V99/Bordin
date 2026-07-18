import { withAuth, jsonOk } from "@/shared/lib/api-route";
import { isStoreSellEnabled } from "@/shared/lib/environment";
import {
  getCashWalletPage,
  requestCashWithdrawal,
  submitUserSheba,
} from "@/server/services/cash-wallet-service";

export const GET = withAuth(async (userId) => {
  if (!isStoreSellEnabled()) {
    throw new Error("فروش سکه غیرفعال است");
  }
  const page = await getCashWalletPage(userId);
  return jsonOk(page);
});

export const POST = withAuth(async (userId, request) => {
  if (!isStoreSellEnabled()) {
    throw new Error("فروش سکه غیرفعال است");
  }
  const body = (await request.json()) as { action?: string; sheba?: string; amount?: number };

  if (body.action === "submit-sheba") {
    const result = await submitUserSheba(userId, body.sheba ?? "");
    return jsonOk(result);
  }

  if (body.action === "withdraw") {
    const result = await requestCashWithdrawal(userId, Number(body.amount ?? 0));
    return jsonOk({ withdrawal: result });
  }

  throw new Error("عملیات نامعتبر");
});
