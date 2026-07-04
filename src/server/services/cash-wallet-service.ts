import {
  CoinTransactionType,
  NotificationCategory,
  NotificationType,
  ShebaVerificationStatus,
  WithdrawalStatus,
} from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb } from "@/server/dev-memory-db";
import { ADMIN_NOTIFY_PHONE, WITHDRAWAL_APPROVED_MESSAGE_FA, WITHDRAWAL_REJECTED_MESSAGE_FA } from "@/shared/constants/wallet";
import {
  formatSmsAmount,
  smsAdminWithdrawalAlert,
  smsShebaRejected,
  smsShebaVerified,
  smsWithdrawalPaid,
  smsWithdrawalReceived,
  userFirstName,
} from "@/shared/constants/sms-templates";
import { buildSmsIrTemplatePayload } from "@/server/config/sms-config";
import { formatShebaDisplay, normalizeShebaDigits, validateShebaDigits } from "@/shared/lib/sheba";
import { createNotification } from "./notification-service";
import { inquireShebaOwnership } from "./sheba-inquiry-service";
import { sendTransactionalSms } from "./sms-service";

async function getUserContext(userId: string) {
  if (await shouldUseMemoryDb()) {
    const user = devMemoryDb.user.findById(userId);
    const profile = devMemoryDb.profile.getByUserId(userId);
    const wallet = devMemoryDb.wallet.getByUserId(userId);
    if (!user || !wallet) throw new Error("کاربر یافت نشد");
    return { user, profile, wallet };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, wallet: true },
  });
  if (!user?.wallet) throw new Error("کاربر یافت نشد");
  return { user, profile: user.profile, wallet: user.wallet };
}

export async function getCashWalletPage(userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.getPage(userId);
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      profile: true,
      wallet: true,
      withdrawals: { orderBy: { createdAt: "desc" }, take: 50 },
    },
  });
  if (!user?.wallet) throw new Error("کیف پول یافت نشد");

  const sellTransactions = await prisma.coinTransaction.findMany({
    where: {
      walletId: user.wallet.id,
      type: CoinTransactionType.SELL,
      amount: { lt: 0 },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const profile = user.profile;
  const shebaVerified = profile?.shebaStatus === ShebaVerificationStatus.VERIFIED;

  return {
    cashBalanceToman: user.wallet.cashBalanceToman,
    sheba: {
      digits: profile?.shebaDigits ?? null,
      display: profile?.shebaDigits ? formatShebaDisplay(profile.shebaDigits) : null,
      status: profile?.shebaStatus ?? ShebaVerificationStatus.NONE,
      submittedAt: profile?.shebaSubmittedAt?.toISOString() ?? null,
      verifiedAt: profile?.shebaVerifiedAt?.toISOString() ?? null,
      canSubmit:
        !profile?.shebaDigits ||
        profile.shebaStatus === ShebaVerificationStatus.NONE ||
        profile.shebaStatus === ShebaVerificationStatus.REJECTED,
      canWithdraw: shebaVerified,
    },
    conversions: sellTransactions.map((tx) => {
      const coinsSold = Math.abs(tx.amount);
      const tomanValue =
        (tx.metadata as { tomanValue?: number } | null)?.tomanValue ?? Math.floor(coinsSold * 45);
      return {
        id: tx.id,
        createdAt: tx.createdAt.toISOString(),
        coinsSold,
        tomanValue,
      };
    }),
    withdrawals: user.withdrawals.map((w) => ({
      id: w.id,
      amountToman: w.amountToman,
      status: w.status,
      createdAt: w.createdAt.toISOString(),
    })),
  };
}

export async function submitUserSheba(userId: string, rawSheba: string) {
  const digits = normalizeShebaDigits(rawSheba);
  validateShebaDigits(digits);

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.submitSheba(userId, digits);
  }

  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) throw new Error("پروفایل یافت نشد");

  if (
    profile.shebaStatus === ShebaVerificationStatus.PENDING_ADMIN ||
    profile.shebaStatus === ShebaVerificationStatus.VERIFIED
  ) {
    throw new Error("شماره شبای شما در حال بررسی یا تأیید شده است");
  }

  await prisma.userProfile.update({
    where: { userId },
    data: {
      shebaDigits: digits,
      shebaStatus: ShebaVerificationStatus.PENDING_ADMIN,
      shebaSubmittedAt: new Date(),
      shebaVerifiedAt: null,
      shebaInquiryMatched: null,
    },
  });

  return { shebaDigits: digits, status: ShebaVerificationStatus.PENDING_ADMIN };
}

export async function requestCashWithdrawal(userId: string, amountToman: number) {
  const amount = Math.floor(amountToman);
  if (amount <= 0) throw new Error("مبلغ نامعتبر است");

  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.requestWithdrawal(userId, amount);
  }

  const { user, profile, wallet } = await getUserContext(userId);
  if (profile?.shebaStatus !== ShebaVerificationStatus.VERIFIED || !profile.shebaDigits) {
    throw new Error("ابتدا شماره شبای خود را ثبت و تأیید کنید");
  }
  if (wallet.cashBalanceToman < amount) {
    throw new Error("موجودی نقد کافی نیست");
  }

  const pending = await prisma.walletWithdrawal.count({
    where: { userId, status: WithdrawalStatus.PENDING },
  });
  if (pending > 0) {
    throw new Error("یک درخواست در حال بررسی دارید");
  }

  const withdrawal = await prisma.walletWithdrawal.create({
    data: {
      userId,
      amountToman: amount,
      bankInfo: { shebaDigits: profile.shebaDigits },
      status: WithdrawalStatus.PENDING,
    },
  });

  const firstName = userFirstName(profile.displayName);
  await sendTransactionalSms(user.phone, smsWithdrawalReceived(firstName));
  await sendTransactionalSms(
    ADMIN_NOTIFY_PHONE,
    smsAdminWithdrawalAlert(profile.displayName ?? user.phone, amount),
    buildSmsIrTemplatePayload("withdrawal_admin_alert", {
      name: profile.displayName?.trim() || user.phone,
      amount: formatSmsAmount(amount),
    }),
  );

  return withdrawal;
}

export async function listPendingShebaForAdmin() {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.listPendingSheba();
  }

  const rows = await prisma.userProfile.findMany({
    where: { shebaStatus: ShebaVerificationStatus.PENDING_ADMIN },
    include: { user: { select: { id: true, phone: true } } },
    orderBy: { shebaSubmittedAt: "asc" },
  });

  return rows.map((row) => ({
    userId: row.userId,
    phone: row.user.phone,
    displayName: row.displayName,
    shebaDigits: row.shebaDigits,
    shebaDisplay: row.shebaDigits ? formatShebaDisplay(row.shebaDigits) : null,
    submittedAt: row.shebaSubmittedAt?.toISOString() ?? null,
    inquiryMatched: row.shebaInquiryMatched,
  }));
}

export async function adminInquireSheba(userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.inquireSheba(userId);
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!profile?.shebaDigits) throw new Error("شماره شبا ثبت نشده");

  const result = await inquireShebaOwnership(profile.shebaDigits, profile.user.phone);
  await prisma.userProfile.update({
    where: { userId },
    data: { shebaInquiryMatched: result.matched },
  });

  return result;
}

export async function adminApproveSheba(userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.approveSheba(userId);
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!profile || profile.shebaStatus !== ShebaVerificationStatus.PENDING_ADMIN) {
    throw new Error("درخواست شبای معتبری یافت نشد");
  }

  await prisma.userProfile.update({
    where: { userId },
    data: {
      shebaStatus: ShebaVerificationStatus.VERIFIED,
      shebaVerifiedAt: new Date(),
    },
  });

  const firstName = userFirstName(profile.displayName);
  await sendTransactionalSms(
    profile.user.phone,
    smsShebaVerified(firstName),
    buildSmsIrTemplatePayload("sheba_verified", { name: firstName }),
  );

  return { status: ShebaVerificationStatus.VERIFIED };
}

export async function adminRequestShebaEdit(userId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.requestShebaEdit(userId);
  }

  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: { user: true },
  });
  if (!profile?.shebaDigits) throw new Error("شماره شبا ثبت نشده");

  await prisma.userProfile.update({
    where: { userId },
    data: {
      shebaStatus: ShebaVerificationStatus.REJECTED,
      shebaVerifiedAt: null,
      shebaInquiryMatched: false,
    },
  });

  const firstName = userFirstName(profile.displayName);
  await sendTransactionalSms(profile.user.phone, smsShebaRejected(firstName));

  return { status: ShebaVerificationStatus.REJECTED };
}

export async function listWithdrawalsForAdmin() {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.listWithdrawals();
  }

  const rows = await prisma.walletWithdrawal.findMany({
    where: { status: WithdrawalStatus.PENDING },
    include: {
      user: { include: { profile: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    displayName: row.user.profile?.displayName ?? row.user.phone,
    phone: row.user.phone,
    amountToman: row.amountToman,
    createdAt: row.createdAt.toISOString(),
    shebaDigits: (row.bankInfo as { shebaDigits?: string })?.shebaDigits ?? null,
  }));
}

export async function adminApproveWithdrawal(withdrawalId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.approveWithdrawal(withdrawalId);
  }

  const withdrawal = await prisma.walletWithdrawal.findUnique({
    where: { id: withdrawalId },
    include: { user: { include: { profile: true, wallet: true } } },
  });
  if (!withdrawal || withdrawal.status !== WithdrawalStatus.PENDING) {
    throw new Error("درخواست یافت نشد");
  }
  if (!withdrawal.user.wallet || withdrawal.user.wallet.cashBalanceToman < withdrawal.amountToman) {
    throw new Error("موجودی کاربر کافی نیست");
  }

  await prisma.$transaction([
    prisma.coinWallet.update({
      where: { userId: withdrawal.userId },
      data: { cashBalanceToman: { decrement: withdrawal.amountToman } },
    }),
    prisma.walletWithdrawal.update({
      where: { id: withdrawalId },
      data: { status: WithdrawalStatus.PAID },
    }),
  ]);

  const profile = withdrawal.user.profile;
  const firstName = userFirstName(profile?.displayName);

  await sendTransactionalSms(
    withdrawal.user.phone,
    smsWithdrawalPaid(firstName, withdrawal.amountToman),
    buildSmsIrTemplatePayload("withdrawal_approved", {
      name: firstName,
      amount: formatSmsAmount(withdrawal.amountToman),
    }),
  );

  await createNotification({
    userId: withdrawal.userId,
    type: NotificationType.SYSTEM,
    category: NotificationCategory.MESSAGE,
    titleFa: "دریافت وجه",
    bodyFa: WITHDRAWAL_APPROVED_MESSAGE_FA,
    link: "/profile/wallet",
  });

  return { status: WithdrawalStatus.PAID };
}

export async function adminRejectWithdrawal(withdrawalId: string) {
  if (await shouldUseMemoryDb()) {
    return devMemoryDb.cashWallet.rejectWithdrawal(withdrawalId);
  }

  const withdrawal = await prisma.walletWithdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal || withdrawal.status !== WithdrawalStatus.PENDING) {
    throw new Error("درخواست یافت نشد");
  }

  await prisma.walletWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: WithdrawalStatus.REJECTED },
  });

  await createNotification({
    userId: withdrawal.userId,
    type: NotificationType.SYSTEM,
    category: NotificationCategory.MESSAGE,
    titleFa: "دریافت وجه",
    bodyFa: WITHDRAWAL_REJECTED_MESSAGE_FA,
    link: "/profile/wallet",
  });

  return { status: WithdrawalStatus.REJECTED };
}
