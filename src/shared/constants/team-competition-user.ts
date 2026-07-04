export const MEMBERSHIP_REQUEST_FREE_WEEKLY = 10;

/** In-app / push banner title when someone requests to join a team. */
export const TEAM_MEMBERSHIP_REQUEST_NOTIFICATION_TITLE = "درخواست عضویت جدید";
export const MEMBERSHIP_REQUEST_EXTRA_FEE = 200;

export function teamCompetitionRankingTabLink(competitionId: string) {
  return `/competitions/teams/${competitionId}?tab=ranking`;
}

export function teamCompetitionKnockoutTabLink(competitionId: string) {
  return `/competitions/teams/${competitionId}?tab=knockout`;
}

export function teamCompetitionActiveListLink() {
  return "/competitions?tab=teams&filter=active";
}

export function teamCompetitionUpcomingListLink() {
  return "/competitions?tab=teams&filter=upcoming";
}

export const TEAM_COMP_NOTIFICATION_COPY = {
  registrationSuccessOwner: (teamName: string, compTitle: string) => ({
    titleFa: "ثبت‌نام موفق تیم",
    bodyFa: `تیم شما (${teamName}) با موفقیت در رقابت (${compTitle}) ثبت‌نام شد.`,
  }),
  registrationSuccessMember: (teamName: string, ownerName: string, compTitle: string) => ({
    titleFa: "ثبت‌نام در رقابت تیمی",
    bodyFa: `تیم شما (${teamName}) توسط مالک آن (${ownerName}) در رقابت گروهی (${compTitle}) با موفقیت شرکت داده شد! حواست باشه که از ثبت پیش‌بینی مرحله رده‌بندی جا نمونی!`,
  }),
  ownerCoveredMember: (teamName: string) => ({
    titleFa: "ثبت‌نام توسط مالک",
    bodyFa: `مالک تیم شما تیمش رو در رقابت تیمی ثبت‌نام کرد. در این حالت هزینه ثبت‌نام از تمام اعضای تیم کسر میشه. اما چون شما سکه کافی نداشتید، ایشان با سخاوتمندی تمام هزینه حضور شما رو متقبل شد!`,
  }),
  notifyMembersToBuyCoins: (teamName: string) => ({
    titleFa: "نیاز به سکه برای ثبت‌نام",
    bodyFa: `مالک تیم ${teamName} قصد داره تیمش رو در رقابت تیمی ثبت‌نام کنه. در این حالت هزینه ثبت‌نام از تمام اعضای تیم کسر میشه. اما چون شما سکه کافی ندارید، منتظر شماست که تعدادی سکه خریداری کنید. ممکنه مالک تیم شما رو به خاطر نداشتن سکه اخراج کنه! پس تا دیر نشده موجودی سکه‌هات رو از فروشگاه افزایش بده.`,
  }),
  memberAskOwnerRegister: (memberName: string, teamName: string) => ({
    titleFa: "درخواست ثبت‌نام در رقابت",
    bodyFa: `یکی از اعضای تیم شما (${memberName}) از شما درخواست کرده که تیم (${teamName}) را در رقابت تیمی ثبت‌نام کنید.`,
  }),
  membershipRequestOwner: (teamName: string) => ({
    titleFa: TEAM_MEMBERSHIP_REQUEST_NOTIFICATION_TITLE,
    bodyFa: `یک نفر درخواست داشته در تیم (${teamName}) شما عضو بشه`,
  }),
  membershipAccepted: (teamName: string) => ({
    titleFa: "پذیرفته شدید",
    bodyFa: `شما در تیم (${teamName}) پذیرفته شدید.`,
  }),
  membershipRejected: (teamName: string) => ({
    titleFa: "رد درخواست عضویت",
    bodyFa: `درخواست عضویت شما در تیم (${teamName}) رد شد.`,
  }),
  knockoutEliminated: (compTitle: string) => ({
    titleFa: "حذف از مرحله حذفی",
    bodyFa: `متاسفانه تیم شما از مرحله حذفی رقابت‌های تیمی (${compTitle}) حذف شد.`,
  }),
  placementChampion: (compTitle: string) => ({
    titleFa: `تیم شما قهرمان رقابت ${compTitle} شد!`,
    bodyFa:
      "تلاش تیم شما ستودنی بود. با این کار علاوه بر اینکه جایزه های رقابت رو دریافت کردید، بلکه یک رزومه عالی برای تیم ساختید. با این رزومه افراد بیشتری به دنبال خرید تیم شما خواهند بود! جایزه رقابت با افتخار به شما داده شد. توجه کن که اگر در زمان رقابت تیمی فعال نبودی، متاسفانه جایزه‌ای به شما تعلق نگرفته!",
  }),
  placementRunnerUp: (compTitle: string) => ({
    titleFa: `تیم شما نایب قهرمان رقابت ${compTitle} شد!`,
    bodyFa:
      "تلاش تیم شما ستودنی بود. با این کار علاوه بر اینکه جایزه های رقابت رو دریافت کردید، بلکه یک رزومه عالی برای تیم ساختید. با این رزومه افراد بیشتری به دنبال خرید تیم شما خواهند بود! جایزه رقابت با افتخار به شما داده شد. توجه کن که اگر در زمان رقابت تیمی فعال نبودی، متاسفانه جایزه‌ای به شما تعلق نگرفته!",
  }),
};
