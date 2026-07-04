import { resolvePublicAppOrigin, resolveSocialShareOrigin } from "@/shared/lib/environment";

export const INVITE_DEFAULT_MAX_FRIENDS = 10;
export const INVITE_DEFAULT_COIN_REWARD = 50;
export const INVITE_DEFAULT_XP_REWARD = 100;
export const INVITE_UNLIMITED_REWARD_PROMO_END_AT = "2026-07-06T20:29:59.999Z";
export const INVITE_UNLIMITED_REWARD_PROMO_DEADLINE_FA = "پایان ۱۵ تیرماه";

export const INVITE_HEADLINE_FA =
  "دوستانت رو به بُردین دعوت کن و به ازای هر نفر ۵۰ سکه و ۱۰۰ امتیاز دریافت کن.";

export const INVITE_SHARE_SECTION_TITLE_FA =
  "متن آماده دعوت از دوستانت رو به اشتراک بذار";

export const INVITE_SUCCESS_TOAST_FA = "با موفقیت کپی شد";

export const INVITE_REFERRER_NOTIFICATION_BODY_FA =
  "دوست شما به بردین پیوست! ۵۰ سکه و ۱۰۰ امتیاز گرفتی.";

export const INVITE_UNLIMITED_REWARD_PROMO_BANNER_FA =
  "تا پایان ۱۵ تیرماه فرصت داری که بدون محدودیت، به ازای هر نفر که دعوت میکنی سکه و امتیاز بگیری. بعد از این مهلت، فقط برای دعوت ۱۰ نفر جایزه میگیری!";

export const INVITE_UNLIMITED_REWARD_ANNOUNCEMENT_TITLE_FA =
  "سقف دعوت به بُردین تا پایان ۱۵ تیرماه، بدون محدودیت شد!";

export const INVITE_UNLIMITED_REWARD_ANNOUNCEMENT_BODY_FA =
  "تا پایان ۱۵ تیرماه فرصت داری که بدون محدودیت، به ازای هر نفر که دعوت میکنی سکه و امتیاز بگیری. بعد از این مهلت، فقط برای دعوت ۱۰ نفر جایزه میگیری!";

export function isInviteUnlimitedRewardPromoActive(now = new Date()) {
  return now.getTime() <= Date.parse(INVITE_UNLIMITED_REWARD_PROMO_END_AT);
}

export function buildInviteShareMessage(inviteLink: string) {
  return `دوست خوبم سلام. من عضو بُردین ( اپلیکیشن پیش‌بینی فوتبال) هستم. جایی که لذت هیجان پیش‌بینی فوتبال و شناخته شدن رو تجربه میکنم. میدونم که تو هم مثل من عاشق هیجان فوتبالی. ازت دعوت میکنم عضو بُردین بشی و دوتایی لذت ببریم. برای عضویت در بُردین روی لینک زیر کلیک کن\n${inviteLink}`;
}

export function buildInviteLoginPath(referralCode: string) {
  return `/login?ref=${encodeURIComponent(referralCode.trim())}`;
}

export function buildInviteLoginUrl(referralCode: string, origin?: string) {
  const base = (origin ?? resolvePublicAppOrigin()).replace(/\/$/, "");
  return `${base}${buildInviteLoginPath(referralCode)}`;
}

export function buildInviteShareLoginUrl(referralCode: string, origin?: string) {
  const base = (origin ?? resolveSocialShareOrigin()).replace(/\/$/, "");
  return `${base}${buildInviteLoginPath(referralCode)}`;
}
