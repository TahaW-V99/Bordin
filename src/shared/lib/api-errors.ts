import { Prisma } from "@prisma/client";

export function isPrismaRecordNotFound(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025"
  );
}

/** Prisma / infra failures that should surface as HTTP 500, not client errors. */
export function isServerError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  if (error instanceof Prisma.PrismaClientUnknownRequestError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1000", "P1001", "P1002", "P1008", "P1010", "P1017", "P2021", "P2022"].includes(error.code);
  }
  return false;
}

export function getApiErrorMessage(error: unknown, fallback = "خطای سرور"): string {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return "اتصال به پایگاه داده برقرار نیست. لطفاً دیتابیس را راه‌اندازی کنید (npm run db:setup).";
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P1001") {
      return "سرور پایگاه داده در دسترس نیست. اتصال دیتابیس را در پنل لیارا بررسی کنید.";
    }
    if (error.code === "P2021") {
      return "جداول دیتابیس به‌روز نیستند. لطفاً با پشتیبانی تماس بگیرید یا بعداً دوباره تلاش کنید.";
    }
    if (error.code === "P2022") {
      return "ساختار دیتابیس با نسخه اپلیکیشن هماهنگ نیست. به‌روزرسانی دیتابیس لازم است.";
    }
    if (error.code === "P2025") {
      return "حساب کاربری یافت نشد. لطفاً دوباره وارد شوید.";
    }
  }

  if (error instanceof Error) {
    if (/fetch failed/i.test(error.message)) {
      return "اتصال به سرویس خارجی برقرار نشد. اینترنت سرور یا کلید API را بررسی کنید.";
    }
    return error.message;
  }

  return fallback;
}
