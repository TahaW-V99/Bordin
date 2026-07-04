/**
 * ترجمه نام تیم‌ها و لیگ‌ها از API (انگلیسی) به فارسی.
 * کلیدها: نام دقیق API یا نام نرمال‌شده.
 */

const TEAM_NAMES_FA: Record<string, string> = {
  // ایران
  "Persepolis FC": "پرسپولیس",
  Persepolis: "پرسپولیس",
  "Esteghlal FC": "استقلال",
  Esteghlal: "استقلال",
  "Sepahan SC": "سپاهان",
  Sepahan: "سپاهان",
  "Tractor SC": "تراکتور",
  Tractor: "تراکتور",
  "Foolad FC": "فولاد",
  Foolad: "فولاد",
  "Gol Gohar Sirjan FC": "گل گهر",
  "Gol Gohar": "گل گهر",
  "Mes Rafsanjan FC": "مس رفسنجان",
  "Sanat Naft FC": "نفت مسجدسلیمان",

  // لالیگا
  "Real Madrid CF": "رئال مادرید",
  "Real Madrid": "رئال مادرید",
  "FC Barcelona": "بارسلونا",
  Barcelona: "بارسلونا",
  "Atlético de Madrid": "اتلتیکو مادرید",
  "Atletico Madrid": "اتلتیکو مادرید",
  "Club Atlético de Madrid": "اتلتیکو مادرید",
  "Sevilla FC": "سویا",
  Sevilla: "سویا",
  "Valencia CF": "والنسیا",
  Valencia: "والنسیا",
  "Villarreal CF": "ویارئال",
  Villarreal: "ویارئال",

  // پریمیرلیگ
  "Manchester City FC": "منچسترسیتی",
  "Manchester City": "منچسترسیتی",
  "Liverpool FC": "لیورپول",
  Liverpool: "لیورپول",
  "Arsenal FC": "آرسنال",
  Arsenal: "آرسنال",
  "Chelsea FC": "چلسی",
  Chelsea: "چلسی",
  "Manchester United FC": "منچستر یونایتد",
  "Manchester United": "منچستر یونایتد",
  "Tottenham Hotspur FC": "تاتنهام",
  "Tottenham Hotspur": "تاتنهام",
  Tottenham: "تاتنهام",
  "Newcastle United FC": "نیوکاسل",
  "Newcastle United": "نیوکاسل",
  "West Ham United FC": "وست هم",
  "West Ham United": "وست هم",
  "Aston Villa FC": "استون ویلا",
  "Aston Villa": "استون ویلا",

  // بوندسلیگا
  "FC Bayern München": "بایرن مونیخ",
  "Bayern Munich": "بایرن مونیخ",
  "FC Bayern Munich": "بایرن مونیخ",
  "Borussia Dortmund": "دورتموند",
  "BV Borussia 09 Dortmund": "دورتموند",
  "RB Leipzig": "لایپزیگ",
  "Bayer 04 Leverkusen": "بایر لورکوزن",
  "Bayer Leverkusen": "بایر لورکوزن",

  // سری آ
  "Juventus FC": "یوونتوس",
  Juventus: "یوونتوس",
  "AC Milan": "آ.ث. میلان",
  Milan: "آ.ث. میلان",
  "FC Internazionale Milano": "اینتر",
  "Inter Milan": "اینتر",
  Internazionale: "اینتر",
  "AS Roma": "رم",
  Roma: "رم",
  "SS Lazio": "لاتسیو",
  Lazio: "لاتسیو",
  "SSC Napoli": "ناپоли",
  Napoli: "ناپоли",

  // لیگ ۱ فرانسه
  "Paris Saint-Germain FC": "پاری سن ژرمن",
  "Paris Saint-Germain": "پاری سن ژرمن",
  PSG: "پاری سن ژرمن",
  "Olympique de Marseille": "مارسی",
  Marseille: "مارسی",
  "Olympique Lyonnais": "لیون",
  Lyon: "لیون",

  // سایر
  "SL Benfica": "بنفیکا",
  Benfica: "بنفیکا",
  "FC Porto": "پورتو",
  Porto: "پورتو",
};

/** تیم‌های ملی — نام‌های رایج در football-data.org */
const NATIONAL_TEAM_NAMES_FA: Record<string, string> = {
  Iran: "ایران",
  "IR Iran": "ایران",
  "Iran IR": "ایران",
  Japan: "ژاپن",
  "Korea Republic": "کره جنوبی",
  "South Korea": "کره جنوبی",
  "Korea DPR": "کره شمالی",
  "North Korea": "کره شمالی",
  "Saudi Arabia": "عربستان",
  Iraq: "عراق",
  Qatar: "قطر",
  "United Arab Emirates": "امارات",
  UAE: "امارات",
  Oman: "عمان",
  Bahrain: "بحرین",
  Kuwait: "کویت",
  Yemen: "یمن",
  Syria: "سوریه",
  Lebanon: "لبنان",
  Jordan: "اردن",
  Palestine: "فلسطین",
  Afghanistan: "افغانستان",
  Uzbekistan: "ازبکستان",
  Tajikistan: "تاجیکستان",
  Turkmenistan: "ترکمنستان",
  India: "هند",
  China: "چین",
  "China PR": "چین",
  Australia: "استرالیا",
  Indonesia: "اندونزی",
  Thailand: "تایلند",
  Vietnam: "ویتنام",
  Malaysia: "مالزی",

  England: "انگلیس",
  France: "فرانسه",
  Germany: "آلمان",
  Spain: "اسپانیا",
  Italy: "ایتالیا",
  Portugal: "پرتغال",
  Netherlands: "هلند",
  Belgium: "بلژیک",
  Croatia: "کرواسی",
  Serbia: "صربستان",
  Switzerland: "سوئیس",
  Austria: "اتریش",
  Poland: "لهستان",
  Ukraine: "اوکراین",
  Sweden: "سوئد",
  Norway: "نروژ",
  Denmark: "دانمارک",
  Finland: "فنلاند",
  "Czech Republic": "جمهوری چک",
  Czechia: "جمهوری چک",
  Slovakia: "اسلواکی",
  Hungary: "مجارستان",
  Romania: "رومانی",
  Greece: "یونان",
  Turkey: "ترکیه",
  Türkiye: "ترکیه",
  Scotland: "اسکاتلند",
  Wales: "ولز",
  "Northern Ireland": "ایرلند شمالی",
  "Republic of Ireland": "ایرلند",
  Ireland: "ایرلند",
  Iceland: "ایسلند",
  Albania: "آلبانی",
  "Bosnia and Herzegovina": "بوسنی",
  Slovenia: "اسلوونی",
  Montenegro: "مونته‌نگرو",
  "North Macedonia": "مقدونیه شمالی",
  Bulgaria: "بلغارستان",
  Georgia: "گرجستان",
  Armenia: "ارمنستان",
  Azerbaijan: "آذربایجان",
  Luxembourg: "لوکزامبورگ",

  Brazil: "برزیل",
  Argentina: "آرژانتین",
  Uruguay: "اروگوئه",
  Chile: "شیلی",
  Colombia: "کلمبیا",
  Peru: "پرو",
  Ecuador: "اکوادور",
  Paraguay: "پاراگوئه",
  Bolivia: "بولیوی",
  Venezuela: "ونزوئلا",
  Mexico: "مکزیک",
  "United States": "آمریکا",
  USA: "آمریکا",
  Canada: "کانادا",
  "Costa Rica": "کاستاریکا",
  Panama: "پاناما",
  Jamaica: "جامائیکا",
  Haiti: "هائیتی",
  Curaçao: "کوراسائو",
  Curacao: "کوراسائو",

  Egypt: "مصر",
  Morocco: "مراکش",
  Tunisia: "تونس",
  Algeria: "الجزایر",
  Nigeria: "نیجریه",
  Senegal: "سنگال",
  Ghana: "غنا",
  Cameroon: "کامرون",
  "South Africa": "آفریقای جنوبی",
  "Côte d'Ivoire": "ساحل عاج",
  "Ivory Coast": "ساحل عاج",

  "New Zealand": "نیوزیلند",
};

const LEAGUE_NAMES_FA: Record<string, string> = {
  "Premier League": "لیگ برتر انگلیس",
  "La Liga": "لالیگا",
  "Primera Division": "لالیگا",
  "Bundesliga": "بوندسلیگا",
  "Serie A": "سری آ",
  "Ligue 1": "لیگ ۱ فرانسه",
  "UEFA Champions League": "لیگ قهرمانان",
  "Champions League": "لیگ قهرمانان",
  "UEFA Europa League": "لیگ اروپا",
  "Europa League": "لیگ اروپا",
  "Persian Gulf Pro League": "لیگ برتر ایران",
  "Primeira Liga": "لیگ برتر پرتغال",
  Eredivisie: "اردیویسه",

  // تورنومنت‌های ملی
  "FIFA World Cup": "جام جهانی",
  "World Cup": "جام جهانی",
  "WC Qualification UEFA": "مقدماتی جام جهانی اروپا",
  "WC Qualification AFC": "مقدماتی جام جهانی آسیا",
  "WC Qualification CAF": "مقدماتی جام جهانی آفریقا",
  "WC Qualification CONMEBOL": "مقدماتی جام جهانی آمریکای جنوبی",
  "WC Qualification CONCACAF": "مقدماتی جام جهانی آمریکای شمالی",
  "European Championship": "یورو",
  "UEFA Euro": "یورو",
  "UEFA Nations League": "لیگ ملت‌های اروپا",
  "Nations League": "لیگ ملت‌های اروپا",
  "AFC Asian Cup": "جام ملت‌های آسیا",
  "Asian Cup": "جام ملت‌های آسیا",
  "Copa America": "کوپا آمریکا",
  "Copa América": "کوپا آمریکا",
  "Africa Cup of Nations": "جام ملت‌های آفریقا",
  "AFCON": "جام ملت‌های آفریقا",
  "International Friendly": "دوستانه بین‌المللی",
  "Friendlies": "دوستانه بین‌المللی",
};

function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeLookupKey(name: string) {
  return stripAccents(name)
    .replace(/\b(FC|CF|AC|SC|SK|SV|VfL|TSG|RB|AFC|BFC|SS|US|1909|1913)\b\.?/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const TEAM_BY_NORMALIZED = new Map<string, string>();
for (const [key, fa] of Object.entries(TEAM_NAMES_FA)) {
  TEAM_BY_NORMALIZED.set(normalizeLookupKey(key), fa);
}

const NATIONAL_BY_NORMALIZED = new Map<string, string>();
for (const [key, fa] of Object.entries(NATIONAL_TEAM_NAMES_FA)) {
  NATIONAL_BY_NORMALIZED.set(normalizeLookupKey(key), fa);
}

const LEAGUE_BY_NORMALIZED = new Map<string, string>();
for (const [key, fa] of Object.entries(LEAGUE_NAMES_FA)) {
  LEAGUE_BY_NORMALIZED.set(normalizeLookupKey(key), fa);
}

function lookupFa(name: string, exactMap: Record<string, string>, normalizedMap: Map<string, string>) {
  const trimmed = name.trim();
  if (!trimmed) return name;

  if (exactMap[trimmed]) return exactMap[trimmed];

  const normalized = normalizeLookupKey(trimmed);
  const fromNormalized = normalizedMap.get(normalized);
  if (fromNormalized) return fromNormalized;

  // اگر قبلاً فارسی است، دست نزن
  if (/[\u0600-\u06FF]/.test(trimmed)) return trimmed;

  return trimmed;
}

export function translateTeamNameToFa(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return name;
  if (/[\u0600-\u06FF]/.test(trimmed)) return trimmed;

  const club = lookupFa(trimmed, TEAM_NAMES_FA, TEAM_BY_NORMALIZED);
  if (club !== trimmed) return club;

  return lookupFa(trimmed, NATIONAL_TEAM_NAMES_FA, NATIONAL_BY_NORMALIZED);
}

export function translateLeagueNameToFa(name: string | null | undefined) {
  if (!name?.trim()) return name ?? null;
  const trimmed = name.trim();
  if (/[\u0600-\u06FF]/.test(trimmed)) return trimmed;

  const exact = lookupFa(trimmed, LEAGUE_NAMES_FA, LEAGUE_BY_NORMALIZED);
  if (exact !== trimmed) return exact;

  for (const [en, fa] of Object.entries(LEAGUE_NAMES_FA)) {
    if (trimmed.includes(en)) return fa;
  }

  return trimmed;
}

export function translateMatchTeamsToFa<T extends { homeTeamName: string; awayTeamName: string; leagueName?: string | null }>(
  match: T,
): T {
  return {
    ...match,
    homeTeamName: translateTeamNameToFa(match.homeTeamName),
    awayTeamName: translateTeamNameToFa(match.awayTeamName),
    ...(match.leagueName !== undefined
      ? { leagueName: translateLeagueNameToFa(match.leagueName) }
      : {}),
  };
}

export function localizeFootballMatch<
  T extends {
    homeTeamName: string;
    awayTeamName: string;
    leagueName?: string | null;
  },
>(match: T): T {
  return translateMatchTeamsToFa(match);
}
