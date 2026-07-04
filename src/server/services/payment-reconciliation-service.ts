import { subHours } from "date-fns";
import { prisma } from "@/shared/lib/prisma";
import { logPaymentEvent } from "@/server/services/payment-logger";
import { verifyAndFinalizeGatewayPayment } from "@/server/services/store-service";

const STUCK_PENDING_HOURS = 24;

function shouldSkipForMemoryDb() {
  return process.env.NODE_ENV !== "production" && process.env.DEV_MEMORY_DB === "true";
}

export async function reconcilePendingPayments() {
  if (shouldSkipForMemoryDb()) {
    return { checked: 0, paid: 0, failed: 0, stillPending: 0 };
  }

  const openStatuses = ["PENDING", "PROCESSING", "UNKNOWN"] as const;
  const rows = await prisma.paymentTransaction.findMany({
    where: {
      paymentMethod: "zibal",
      status: { in: [...openStatuses] },
      createdAt: { gte: subHours(new Date(), STUCK_PENDING_HOURS) },
    },
    orderBy: { createdAt: "asc" },
    take: 50,
  });

  let paid = 0;
  let failed = 0;
  let stillPending = 0;

  for (const payment of rows) {
    if (!payment.zibalTrackId) {
      if (payment.status === "PENDING") {
        await prisma.paymentTransaction.update({
          where: { id: payment.id },
          data: { status: "FAILED" },
        });
        failed += 1;
        logPaymentEvent({
          step: "reconciliation",
          paymentId: payment.id,
          userId: payment.userId,
          status: "FAILED",
          message: "missing_track_id",
        });
      }
      continue;
    }

    const result = await verifyAndFinalizeGatewayPayment({
      paymentId: payment.id,
      trackId: payment.zibalTrackId,
      source: "reconciliation",
    });

    logPaymentEvent({
      step: "reconciliation",
      paymentId: payment.id,
      userId: payment.userId,
      trackId: payment.zibalTrackId,
      status: result.status,
      metadata: { alreadyFinalized: result.alreadyFinalized },
    });

    if (result.status === "PAID") paid += 1;
    else if (result.status === "FAILED") failed += 1;
    else stillPending += 1;
  }

  const stuckCount = await prisma.paymentTransaction.count({
    where: {
      paymentMethod: "zibal",
      status: { in: [...openStatuses] },
      createdAt: { lt: subHours(new Date(), 1) },
    },
  });

  if (stuckCount > 0) {
    console.warn(`[Bordin:payment] ${stuckCount} stuck open transactions older than 1 hour`);
  }

  return { checked: rows.length, paid, failed, stillPending, stuckCount };
}

export async function getPaymentHealthSummary() {
  if (shouldSkipForMemoryDb()) {
    return { stuckPending: 0, openCount: 0 };
  }

  const openStatuses = ["PENDING", "PROCESSING", "UNKNOWN"] as const;
  const [openCount, stuckPending] = await Promise.all([
    prisma.paymentTransaction.count({
      where: { paymentMethod: "zibal", status: { in: [...openStatuses] } },
    }),
    prisma.paymentTransaction.count({
      where: {
        paymentMethod: "zibal",
        status: { in: [...openStatuses] },
        createdAt: { lt: subHours(new Date(), 1) },
      },
    }),
  ]);

  return { openCount, stuckPending };
}
