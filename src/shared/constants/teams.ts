export const TEAM_LOGO_COUNT = 10;

/** Paid logo keys: 2, 4, 8 */
export const PAID_TEAM_LOGO_KEYS = [2, 4, 8] as const;

export function isSelectableTeamLogo(key: number) {
  return key >= 1 && key <= TEAM_LOGO_COUNT;
}

export function selectableTeamLogoKeys() {
  return Array.from({ length: TEAM_LOGO_COUNT }, (_, i) => i + 1);
}

export const TEAM_LOGO_COST = 300;
export const TEAM_FORMATION_FEE = 150;
export const TEAM_JOIN_FEE = 150;
export const TEAM_RENAME_FEE = 1000;
export const TEAM_REMOVE_MEMBER_FEE = 600;
export const TEAM_EXTRA_INVITE_FEE = 100;
export const TEAM_LEAVE_FEE = 350;
export const TEAM_FREE_INVITE_LIMIT = 20;
export const TEAM_MEMBER_REINVITE_BAN_DAYS = 30;

export const TEAM_MEMBER_REINVITE_BAN_ERROR =
  "شما قبلا این فرد را از تیم خود حذف کرده‌اید، تا ۱ ماه آینده امکان ارسال درخواست عضویت وجود ندارد";

export const TEAM_ALREADY_MEMBER_ERROR = "این کاربر هم‌اکنون عضو تیم شما است";

export const TEAM_MEMBERSHIP_CONFLICT_CODE = "TEAM_MEMBERSHIP_CONFLICT";

export class TeamMembershipConflictError extends Error {
  readonly code = TEAM_MEMBERSHIP_CONFLICT_CODE;

  constructor(
    public readonly currentTeamId: string,
    public readonly currentTeamName: string,
    public readonly isOwner: boolean,
  ) {
    super(TEAM_MEMBERSHIP_CONFLICT_CODE);
    this.name = "TeamMembershipConflictError";
  }
}

export const TEAM_LOGO_BASE = "/images/team-logos";

export function teamLogoUrl(key: number) {
  return `${TEAM_LOGO_BASE}/${key}.png`;
}

export function resolveTeamLogoUrl(team: { logoKey?: number | null; logoUrl?: string | null }) {
  if (team.logoKey != null && team.logoKey >= 1) return teamLogoUrl(team.logoKey);
  return team.logoUrl ?? null;
}

export function isPaidTeamLogo(key: number) {
  return PAID_TEAM_LOGO_KEYS.includes(key as (typeof PAID_TEAM_LOGO_KEYS)[number]);
}

export const TEAM_INTRO_SLIDES = [
  {
    id: 1,
    title: "به رقابت‌های تیمی خوش آمدید!",
    description:
      "به یکی از جذاب‌ترین بخش‌های بُردین خوش آمدید! از این طریق می‌تونید تیم بسازید، در رقابت‌های تیمی مختلف و هیجان‌انگیز شرکت کنید و افتخارات زیادی کسب کنید. مهم‌ترین مزیت مالک تیم بودن برای شما اینه که می‌تونید تیمتون رو به باقی بازیکن‌ها بفروشید! برای آشنایی بیشتر با این بخش، برو اسلاید بعدی.",
  },
  {
    id: 2,
    title: "ساختار تیم",
    description:
      "هر تیم از یک مالک و چند عضو تشکیل شده. مالک تیم مشخص می‌کنه که اعضای تیم در هر رقابت چه وظایفی داشته باشن. مثلاً در رقابت‌های تیمی که هر تیم یک پیش‌بینی ثبت می‌کنه، مالک کاپیتان تیم رو مشخص می‌کنه که وظیفه ثبت پیش‌بینی گروهی رو داره.",
  },
  {
    id: 3,
    title: "مدیریت تیم",
    description:
      "شما به عنوان مالک تیم می‌تونید ساختار تیم رو تغییر بدید که شانس پیروزی در مسابقات بیشتری داشته باشید و افتخارات بیشتری کسب کنید.",
  },
  {
    id: 4,
    title: "جوایز رقابت‌های تیمی",
    description:
      "مسابقات تیمی جایزه‌های متنوع و جذابی داره که تنها با داشتن تیم امکان حضور در اون‌ها وجود داره.",
  },
  {
    id: 5,
    title: "آماده‌ای؟",
    description:
      "حالا که آماده شدی، اولین تیمت رو بساز و بعداً در مسابقات دلخواه، تیمت رو وارد رقابت کن تا بتونی یک تیم پر افتخاری بسازی که شایسته فروختن هم باشه!",
  },
] as const;

export const TEAM_INVITE_SHARE_MESSAGE =
  "سلام رفیق. من در بُردین (اپلیکیشن پیش‌بینی فوتبال) قصد دارم تیم تشکیل بدم و دنبال یار می‌گردم. حاضری هم تیمی من بشی و باهم یک تجربه ماندگار بسازیم و کلی کیف کنیم؟ روی لینک زیر کلیک کن و در بُردین ثبت نام کن.";

export const TEAM_MEDAL_SLUGS = ["team-qahraman", "team-raqib"] as const;
