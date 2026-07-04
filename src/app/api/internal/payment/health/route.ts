import { NextResponse } from "next/server";
import { getPaymentHealthSummary } from "@/server/services/payment-reconciliation-service";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";

function authorize(request: Request) {
  const token = process.env.KANDAKATOR_SYNC_PUSH_TOKEN?.trim();
  if (!token) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

export async function GET(request: Request) {
  if (!authorize(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await getPaymentHealthSummary();

  if (await shouldUseMemoryDb()) {
    return NextResponse.json({ status: "mock", ...summary });
  }

  const lastPaid = await prisma.paymentTransaction.findFirst({
    where: { status: "PAID", paymentMethod: "zibal" },
    orderBy: { updatedAt: "desc" },
    select: { id: true, updatedAt: true, amountToman: true, zibalRefNumber: true },
  });

  return NextResponse.json({
    status: summary.stuckPending > 0 ? "degraded" : "healthy",
    provider: "zibal",
    openTransactions: summary.openCount,
    stuckPending: summary.stuckPending,
    lastPaidPayment: lastPaid
      ? {
          id: lastPaid.id,
          amountToman: lastPaid.amountToman,
          refNumber: lastPaid.zibalRefNumber,
          at: lastPaid.updatedAt.toISOString(),
        }
      : null,
  });
}
