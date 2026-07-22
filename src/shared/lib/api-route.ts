import { NextResponse } from "next/server";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage, isServerError } from "@/shared/lib/api-errors";
import { energyErrorToResponse } from "@/server/services/energy-service";
import { runWithAssetPaymentContext } from "@/server/services/asset-payment-context";
import { footballCreditConfirmationResponse } from "@/server/services/asset-payment-response";

/**
 * Reads the `allowFootballCredit` confirmation flag from a request body without
 * consuming the caller's body (uses a clone). Returns false for bodyless
 * requests. Powers the centralized asset-payment confirmation flow.
 */
export async function readAllowFootballCredit(request: Request): Promise<boolean> {
  if (request.method === "GET" || request.method === "HEAD") return false;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return false;
  try {
    const data = (await request.clone().json()) as { allowFootballCredit?: unknown };
    return data?.allowFootballCredit === true;
  } catch {
    return false;
  }
}

export function withAuth(
  handler: (userId: string, request: Request) => Promise<NextResponse>,
) {
  return async (request: Request) => {
    try {
      const session = await getSession();
      if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const allowFootballCredit = await readAllowFootballCredit(request);
      return await runWithAssetPaymentContext(allowFootballCredit, () =>
        handler(session.userId, request),
      );
    } catch (error) {
      const confirm = footballCreditConfirmationResponse(error);
      if (confirm) return confirm;
      const energy = energyErrorToResponse(error);
      if (energy) {
        return NextResponse.json(energy.body, { status: energy.status });
      }
      const message = getApiErrorMessage(error);
      const status = isServerError(error) ? 500 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  };
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonCaughtError(error: unknown, fallbackStatus = 400) {
  const confirm = footballCreditConfirmationResponse(error);
  if (confirm) return confirm;
  const energy = energyErrorToResponse(error);
  if (energy) {
    return NextResponse.json(energy.body, { status: energy.status });
  }
  const message = getApiErrorMessage(error);
  const status = isServerError(error) ? 500 : fallbackStatus;
  return NextResponse.json({ error: message }, { status });
}
