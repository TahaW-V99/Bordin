import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/shared/lib/auth";
import { getApiErrorMessage } from "@/shared/lib/api-errors";
import { buyPackage, createGatewayCheckout } from "@/server/services/store-service";
import { resolveStoreReturnOrigin } from "@/shared/lib/environment";

const schema = z.object({
  packageId: z.string(),
  method: z.enum(["wallet", "gateway"]).default("gateway"),
  returnOrigin: z.string().url().optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const body = schema.parse(await request.json());
    if (body.method === "gateway") {
      const callbackBaseUrl = resolveStoreReturnOrigin(request, body.returnOrigin);
      const gateway = await createGatewayCheckout({
        userId: session.userId,
        packageId: body.packageId,
        callbackBaseUrl,
      });
      return NextResponse.json({
        success: true,
        package: gateway.pkg,
        paymentId: gateway.paymentId,
        trackId: gateway.trackId,
        paymentUrl: gateway.paymentUrl,
      });
    }
    const result = await buyPackage(session.userId, body.packageId, body.method);
    return NextResponse.json({
      success: true,
      package: result.pkg,
      paymentId: result.paymentId,
    });
  } catch (error) {
    return NextResponse.json({ error: getApiErrorMessage(error) }, { status: 400 });
  }
}
