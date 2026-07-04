export const SHEBA_DIGITS_LENGTH = 24;

export const ADMIN_NOTIFY_PHONE = process.env.ADMIN_NOTIFY_PHONE ?? "09010558858";

export const WITHDRAWAL_STATUS_LABELS: Record<string, string> = {
  PENDING: "در حال بررسی",
  PAID: "تأیید شده",
  REJECTED: "رد شده",
  APPROVED: "تأیید شده",
};

export const WITHDRAWAL_APPROVED_MESSAGE_FA = "درخواست دریافت وجه شما مورد تایید قرار گرفت.";
export const WITHDRAWAL_REJECTED_MESSAGE_FA =
  "درخواست دریافت وجه شما متاسفانه مورد تایید قرار نگرفت.";

export const SHEBA_STATUS_LABELS: Record<string, string> = {
  NONE: "ثبت نشده",
  PENDING_ADMIN: "در انتظار تأیید",
  VERIFIED: "تأیید شده",
  REJECTED: "رد شده",
};

export function shebaStatusTextClass(status: string) {
  switch (status) {
    case "PENDING_ADMIN":
      return "text-bordin-orange";
    case "REJECTED":
      return "text-red-400";
    case "VERIFIED":
      return "text-bordin-green";
    default:
      return "text-white/45";
  }
}

export function withdrawalStatusCardClass(status: string) {
  switch (status) {
    case "REJECTED":
      return "border-red-500/45 bg-red-500/10";
    case "PAID":
    case "APPROVED":
      return "border-bordin-green/45 bg-bordin-green/10";
    default:
      return "border-white/8";
  }
}

export function withdrawalStatusTextClass(status: string) {
  switch (status) {
    case "REJECTED":
      return "text-red-400";
    case "PAID":
    case "APPROVED":
      return "text-bordin-green";
    default:
      return "text-bordin-orange";
  }
}
