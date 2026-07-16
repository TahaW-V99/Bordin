import { CoinTransactionType, CoinType, PaymentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { BUY_COIN_PACKAGES, SELL_COIN_PACKAGES } from "@/shared/constants/store";
import { addPurchasedCoins, sellPredictionCoins } from "./wallet-service";
import { isPaymentGatewayMockMode } from "./payment-gateway";
import { logPaymentEvent } from "./payment-logger";
import { createZibalPaymentRequest, tomanToRials, verifyZibalPayment } from "./zibal-service";
import { resolveStoreReturnOrigin } from "@/shared/lib/environment";

export function resolvePaymentReturnOrigin(
  request: Pick<Request, "headers">,
  storedOrigin?: string | null,
) {
  return resolveStoreReturnOrigin(request, storedOrigin);
}

const FINAL_STATUSES: PaymentStatus[] = ["PAID", "FAILED"];

export async function getCoinPackages() {
  return BUY_COIN_PACKAGES;
}

export async function buyPackage(userId: string, packageId: string, method: "wallet" | "gateway") {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.store.buyPackage(userId, packageId, method);
  }

  const pkg = BUY_COIN_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new Error("بسته یافت نشد");

  if (method === "wallet") {
    const wallet = await prisma.coinWallet.findUnique({ where: { userId } });
    if (!wallet || wallet.cashBalanceToman < pkg.priceToman) {
      throw new Error("موجودی کیف پول کافی نیست");
    }
    await prisma.coinWallet.update({
      where: { userId },
      data: { cashBalanceToman: { decrement: pkg.priceToman } },
    });
    await addPurchasedCoins(userId, pkg.coinAmount, `خرید ${pkg.nameFa}`);
    const result = await prisma.paymentTransaction.create({
      data: {
        userId,
        packageId: pkg.id,
        amountToman: pkg.priceToman,
        coinsGranted: pkg.coinAmount,
        status: "PAID",
        paymentMethod: "wallet",
      },
    });
    return { pkg, paymentId: result.id };
  }

  const payment = await prisma.paymentTransaction.create({
    data: {
      userId,
      packageId: pkg.id,
      amountToman: pkg.priceToman,
      coinsGranted: 0,
      status: "PENDING",
      paymentMethod: "zibal",
    },
  });

  logPaymentEvent({
    step: "request_created",
    paymentId: payment.id,
    userId,
    status: "PENDING",
  });

  return { pkg, paymentId: payment.id };
}

export async function createGatewayCheckout(input: {
  userId: string;
  packageId: string;
  callbackBaseUrl: string;
}) {
  const result = await buyPackage(input.userId, input.packageId, "gateway");
  const callbackUrl = `${input.callbackBaseUrl}/api/store/gateway/callback?paymentId=${result.paymentId}`;

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { phone: true },
  });

  const zibal = await createZibalPaymentRequest({
    amountToman: result.pkg.priceToman,
    description: `خرید ${result.pkg.nameFa}`,
    callbackUrl,
    orderId: result.paymentId,
    mobile: user?.phone,
  });

  await prisma.paymentTransaction.update({
    where: { id: result.paymentId },
    data: {
      merchantId: zibal.merchantId,
      zibalTrackId: zibal.trackId,
      returnOrigin: input.callbackBaseUrl.replace(/\/$/, ""),
    },
  });

  logPaymentEvent({
    step: "redirect",
    paymentId: result.paymentId,
    userId: input.userId,
    trackId: zibal.trackId,
    metadata: { mock: isPaymentGatewayMockMode() },
  });

  const paymentUrl = isPaymentGatewayMockMode()
    ? `${input.callbackBaseUrl}/store/payment/gateway?paymentId=${result.paymentId}`
    : zibal.startPayUrl;

  return {
    ...result,
    trackId: zibal.trackId,
    paymentUrl,
  };
}

export type VerifyFinalizeResult = {
  status: PaymentStatus;
  packageCoins?: number;
  alreadyFinalized: boolean;
};

/** Server-to-server verification — idempotent, never trusts callback success flag alone */
export async function verifyAndFinalizeGatewayPayment(input: {
  paymentId: string;
  trackId: string;
  callbackPayload?: Record<string, unknown>;
  source: "callback" | "mock" | "reconciliation";
  mockOutcome?: "success" | "failed";
}) {
  if (await shouldUseMemoryDb()) {
    return { status: "PAID" as const, packageCoins: 0, alreadyFinalized: false };
  }

  const payment = await prisma.paymentTransaction.findUnique({ where: { id: input.paymentId } });
  if (!payment) throw new Error("تراکنش یافت نشد");

  if (FINAL_STATUSES.includes(payment.status)) {
    return {
      status: payment.status,
      packageCoins: payment.coinsGranted,
      alreadyFinalized: true,
    };
  }

  if (payment.zibalTrackId && payment.zibalTrackId !== input.trackId) {
    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: {
        status: "FAILED",
        callbackPayload: (input.callbackPayload ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    throw new Error("trackId نامعتبر است");
  }

  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      status: "PROCESSING",
      callbackPayload: (input.callbackPayload ?? undefined) as Prisma.InputJsonValue | undefined,
      zibalTrackId: payment.zibalTrackId ?? input.trackId,
    },
  });

  logPaymentEvent({
    step: "verification_started",
    paymentId: payment.id,
    userId: payment.userId,
    trackId: input.trackId,
    metadata: { source: input.source },
  });

  const verification = await verifyZibalPayment({
    trackId: input.trackId,
    expectedAmountRials: tomanToRials(payment.amountToman),
    mockOutcome: input.mockOutcome,
  });

  await prisma.paymentTransaction.update({
    where: { id: payment.id },
    data: {
      verificationResponse: verification.raw as object,
    },
  });

  if (!verification.verified) {
    const nextStatus: PaymentStatus =
      verification.resultCode === 202 || verification.resultCode === 203
        ? "FAILED"
        : "UNKNOWN";

    await prisma.paymentTransaction.update({
      where: { id: payment.id },
      data: { status: nextStatus },
    });

    logPaymentEvent({
      step: "verification_failed",
      paymentId: payment.id,
      userId: payment.userId,
      trackId: input.trackId,
      status: nextStatus,
      message: verification.errorMessage,
    });

    return { status: nextStatus, alreadyFinalized: false };
  }

  const pkg = BUY_COIN_PACKAGES.find((p) => p.id === payment.packageId);
  if (!pkg) throw new Error("بسته خرید معتبر نیست");

  const updated = await prisma.paymentTransaction.updateMany({
    where: {
      id: payment.id,
      status: { in: ["PENDING", "PROCESSING", "UNKNOWN"] },
    },
    data: {
      status: "PAID",
      coinsGranted: pkg.coinAmount,
      zibalRefNumber: verification.refNumber ?? undefined,
    },
  });

  if (updated.count === 0) {
    const current = await prisma.paymentTransaction.findUnique({ where: { id: payment.id } });
    return {
      status: (current?.status ?? "FAILED") as PaymentStatus,
      packageCoins: current?.coinsGranted ?? 0,
      alreadyFinalized: true,
    };
  }

  await addPurchasedCoins(payment.userId, pkg.coinAmount, `خرید ${pkg.nameFa}`);

  logPaymentEvent({
    step: "verification_success",
    paymentId: payment.id,
    userId: payment.userId,
    trackId: input.trackId,
    status: "PAID",
    metadata: { refNumber: verification.refNumber },
  });

  logPaymentEvent({
    step: "coins_granted",
    paymentId: payment.id,
    userId: payment.userId,
    metadata: { coins: pkg.coinAmount },
  });

  return {
    status: "PAID" as const,
    packageCoins: pkg.coinAmount,
    alreadyFinalized: false,
  };
}

export async function failGatewayPayment(paymentId: string, reason?: string) {
  if (await shouldUseMemoryDb()) {
    return { failed: true };
  }

  const payment = await prisma.paymentTransaction.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("تراکنش پرداخت معتبر نیست");

  if (payment.status === "PAID") {
    return { failed: false, alreadyPaid: true };
  }
  if (payment.status === "FAILED") {
    return { failed: true, alreadyFailed: true };
  }

  await prisma.paymentTransaction.update({
    where: { id: paymentId },
    data: { status: "FAILED", coinsGranted: 0 },
  });

  logPaymentEvent({
    step: "marked_failed",
    paymentId,
    userId: payment.userId,
    status: "FAILED",
    message: reason,
  });

  return { failed: true };
}

export async function getPurchaseHistory(userId: string) {
  if (await shouldUseMemoryDb()) return [];

  try {
    const rows = await prisma.paymentTransaction.findMany({
      where: { userId, status: "PAID", coinsGranted: { gt: 0 } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      amountToman: row.amountToman,
      coinsGranted: row.coinsGranted,
    }));
  } catch (error) {
    console.error("[store] purchase history prisma query failed, using raw fallback:", error);
    try {
      const rows = await prisma.$queryRaw<
        Array<{
          id: string;
          createdAt: Date;
          amountToman: number;
          coinsGranted: number;
        }>
      >`
        SELECT id, createdAt, amountToman, coinsGranted
        FROM payment_transactions
        WHERE userId = ${userId} AND coinsGranted > 0
        ORDER BY createdAt DESC
        LIMIT 30
      `;
      return rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        amountToman: row.amountToman,
        coinsGranted: row.coinsGranted,
      }));
    } catch (fallbackError) {
      console.error("[store] purchase history raw fallback failed:", fallbackError);
      return [];
    }
  }
}

export async function getCoinPurchaseTransactionsForAdmin() {
  if (await shouldUseMemoryDb()) return [];

  const rows = await prisma.paymentTransaction.findMany({
    where: { status: "PAID", coinsGranted: { gt: 0 } },
    include: { user: { include: { profile: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return rows.map((row) => ({
    id: row.id,
    displayName: row.user.profile?.displayName ?? row.user.phone,
    phone: row.user.phone,
    amountToman: row.amountToman,
    coinsGranted: row.coinsGranted,
    method: row.paymentMethod === "wallet" ? "wallet" : "zibal",
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function getSellPackages() {
  return SELL_COIN_PACKAGES;
}

export async function sellByPackage(_userId: string, _coinAmount: number) {
  throw new Error("فروش سکه غیرفعال است");
}

export async function getStoreWallet(userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.wallet.getByUserId(userId) ?? null;
  }
  return prisma.coinWallet.findUnique({ where: { userId } });
}

export async function getPaymentById(userId: string | null, paymentId: string) {
  if (await shouldUseMemoryDb()) return null;
  return prisma.paymentTransaction.findFirst({
    where: userId ? { id: paymentId, userId } : { id: paymentId },
  });
}

export async function sellCoins(userId: string, amount: number) {
  if (amount < 100) throw new Error("حداقل ۱۰۰ سکه برای فروش");
  return sellPredictionCoins(userId, amount);
}

export async function getWalletDetails(userId: string) {
  if (await shouldUseMemoryDb()) {
    const wallet = devMemoryDb.wallet.getByUserId(userId);
    const txs =
      (globalThis as unknown as { __bordinDevDb?: { competitionData: { transactions: Array<{ userId: string }> } } })
        .__bordinDevDb?.competitionData.transactions.filter((t) => t.userId === userId) ?? [];
    return { wallet, transactions: txs };
  }

  const wallet = await prisma.coinWallet.findUnique({
    where: { userId },
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  return { wallet, transactions: wallet?.transactions ?? [] };
}

export { BUY_COIN_PACKAGES };
