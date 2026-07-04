export function userFirstName(displayName: string | null | undefined) {
  if (!displayName?.trim()) return "کاربر";
  return displayName.trim();
}

export function formatSmsAmount(amountToman: number) {
  return amountToman.toLocaleString("fa-IR");
}

export function smsShebaVerified(name: string) {
  return `سلام ${name}\nشماره شبای شما توسط ادمین تایید شد.\nbordin.ir`;
}

export function smsShebaRejected(name: string) {
  return `${name} عزیز، شماره شبای شما به دلیل عدم تطبیق مالک شماره تماس و شماره حساب، تایید نشد. بُردین`;
}

export function smsWithdrawalReceived(name: string) {
  return `${name} عزیز، درخواست انتقال وجه شما دریافت شد. به زودی نتیجه به شما گزارش داده میشه. بُردین`;
}

export function smsWithdrawalPaid(name: string, amountToman: number) {
  const amount = formatSmsAmount(amountToman);
  return `سلام ${name}، درخواست انتقال وجه شما تایید شد. مبلغ ${amount} به حساب شما واریز خواهد شد.\nbordin.ir`;
}

export function smsAdminWithdrawalAlert(name: string, amountToman: number) {
  const amount = formatSmsAmount(amountToman);
  return `کاربر ${name} درخواست دریافت وجه به مبلغ ${amount} دارد.`;
}
