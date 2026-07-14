export const WATCH_PARTY_INVITE_NOTIFICATION_TYPE = "WATCH_PARTY_INVITE" as const;

export const WATCH_PARTY_DISABLED_TOOLTIP =
  "امکان حضور در تماشای آنلاین گروهی، ۳۰ دقیقه قبل از شروع بازی فراهم میشه. در این حالت میتونید روی دکمه کلیک کنید و با دوستان به صورت آنلاین مسابقه را تماشا کنید";

export const WATCH_PARTY_ACTIVE_TOOLTIP =
  "تماشا مسابقه فوتبال با دوستان یه صفایی دیگه ای داره! بزن بریم.";

export const WATCH_PARTY_JOIN_DESCRIPTION =
  "یک فضای آنلاین برای شما ایجاد کردیم که با دوستانت فوتبال ببینی، کوری بخونی، کَل کَل کنی و لذت ببری. در اتاق تماشا میتونی به صورت صوتی یا از طریق چت، حس و حال دور هم بودن رو هم تجربه کنی. فقط توجه کن که اگر داور اتاق متوجه بشه باعث بی‌احترامی به کسی شدی، به کاپیتان بُردین خبر میده و ممکنه اعتبارت در بُردین کاهش پیدا کنه. فکر نکنم بخوایی در جمع بُردین برچسب فرد بی‌اخلاق بهت بخوره. توجه: برای ورود لازمه که نرم افزار گوگل میت رو نصب کرده باشی.";

export const WATCH_PARTY_REJOIN_DESCRIPTION =
  "شما هزینه ورود به اتاق تماشای گروهی رو پرداخت کردی. میخوایی دوباره وارد اتاق بشی یا دوستات رو دعوت کنی؟";

export const WATCH_PARTY_INVITE_CAPACITY_ERROR = "بیشتر از ظرفیت اتاق امکان دعوت وجود ندارد";

export const WATCH_PARTY_FULL_MESSAGE = "دیر اومدی! ظرفیت اتاق تکمیل شده!";

export const WATCH_PARTY_INSUFFICIENT_COINS = "متاسفانه سکه شما برای ورود کافی نیست";

export const WATCH_PARTY_PROMO_DISMISS_KEY = "bordin:watch-party-promo-dismissed:v1";

/** شروع نمایش پاپ‌آپ تبلیغ واچ‌پارتی در هوم — ۲۳ تیر ۱۴۰۵، به مدت ۳ روز */
export const WATCH_PARTY_PROMO_START_MS = Date.parse("2026-07-14T00:00:00+03:30");

export const WATCH_PARTY_PROMO_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

export const WATCH_PARTY_ANNOUNCEMENT_TITLE_FA =
  "تماشای گروهی مسابقات فوتبال به بُردین اضافه شد!";

export const WATCH_PARTY_ANNOUNCEMENT_BODY_FA =
  'دیدن مسابقه فوتبال با رفقا یک صفای دیگه‌ای داره! از این به بعد میتونی با کلیک روی دکمه "تماشای گروهی" به صورت آنلاین مسابقات رو با دوستانت تماشا کنی. توجه کن که ۳۰ دقیقه قبل از شروع شدن یک مسابقه میتونی وارد اتاق آنلاین بشی. میتونی حتی دوستات رو هم خبر کنی که باهم مسابقه رو تماشا کنید. ولی قبلش باید در بُردین ثبت نام کرده باشن';

export const WATCH_PARTY_ANNOUNCEMENT_LINK = "/home?highlightWatchParty=1";

export const WATCH_PARTY_ANNOUNCEMENT_ACTION_LABEL_FA = "نشانم بده";

export const WATCH_PARTY_HIGHLIGHT_BLINK_MS = 7_000;

export const ONLINE_PRESENCE_MS = 5 * 60 * 1000;
