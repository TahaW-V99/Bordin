import { addDays, startOfWeek } from "date-fns";
import { fromZonedTime, formatInTimeZone, toZonedTime } from "date-fns-tz";
import type { MemoryKandakator, MemoryMatch } from "@/server/dev-memory-db";
import {
  formatShamsiShort,
  formatShamsiWeekday,
  TEHRAN_TZ,
} from "@/shared/lib/dates";
function tehranDateKey(date: Date) {
  return formatInTimeZone(date, TEHRAN_TZ, "yyyy-MM-dd");
}

function tehranKickoffAt(dateKey: string, hour: number, minute: number) {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return fromZonedTime(`${dateKey}T${hh}:${mm}:00`, TEHRAN_TZ);
}

function createMatch(
  id: string,
  homeTeamName: string,
  awayTeamName: string,
  leagueName: string,
  kickoffAt: Date,
): MemoryMatch {
  return {
    id,
    homeTeamName,
    awayTeamName,
    leagueName,
    kickoffAt,
    homeScore: null,
    awayScore: null,
    status: "SCHEDULED",
  };
}

export function getTehranWeekStart(base = new Date()) {
  const tehranNow = toZonedTime(base, TEHRAN_TZ);
  const weekStartLocal = startOfWeek(tehranNow, { weekStartsOn: 6 });
  return fromZonedTime(weekStartLocal, TEHRAN_TZ);
}

export function buildWeekKandakators(): Map<string, MemoryKandakator> {
  const map = new Map<string, MemoryKandakator>();
  const weekStart = getTehranWeekStart();

  const dayPlans: Array<{
    title: string;
    leagues: Array<{
      league: string;
      fixtures: Array<[string, string, number, number]>;
    }>;
  }> = [
    {
      title: "شنبه — رقابت روزانه",
      leagues: [
        {
          league: "لالیگا",
          fixtures: [
            ["رئال مادرید", "بارسلونا", 18, 30],
            ["اتلتیکو مادرید", "سویا", 20, 45],
          ],
        },
        {
          league: "لیگ برتر ایران",
          fixtures: [["پرسپولیس", "استقلال", 19, 0]],
        },
      ],
    },
    {
      title: "یکشنبه — رقابت روزانه",
      leagues: [
        {
          league: "پریمیرلیگ",
          fixtures: [
            ["منچسترسیتی", "لیورپول", 17, 0],
            ["آرسنال", "چلسی", 19, 30],
          ],
        },
      ],
    },
    {
      title: "دوشنبه — رقابت روزانه",
      leagues: [
        {
          league: "سری آ",
          fixtures: [
            ["یوونتوس", "آ.ث. میلان", 18, 0],
            ["اینتر", "رم", 20, 30],
          ],
        },
      ],
    },
    {
      title: "سه‌شنبه — رقابت روزانه",
      leagues: [
        {
          league: "بوندسلیگا",
          fixtures: [["بایرن مونیخ", "دورتموند", 18, 30]],
        },
        {
          league: "جام حذفی",
          fixtures: [["سپاهان", "تراکتور", 20, 0]],
        },
      ],
    },
    {
      title: "چهارشنبه — رقابت روزانه",
      leagues: [
        {
          league: "لیگ قهرمانان",
          fixtures: [
            ["پاری سن ژرمن", "منچستر یونایتد", 19, 45],
            ["رئال مادرید", "منچسترسیتی", 22, 0],
          ],
        },
      ],
    },
    {
      title: "پنجشنبه — رقابت روزانه",
      leagues: [
        {
          league: "لالیگا",
          fixtures: [["والنسیا", "ویارئال", 18, 0]],
        },
      ],
    },
    {
      title: "جمعه — رقابت روزانه",
      leagues: [
        {
          league: "لیگ برتر ایران",
          fixtures: [
            ["سپاهان", "فولاد", 17, 30],
            ["گل گهر", "مس کرمان", 20, 0],
          ],
        },
      ],
    },
  ];

  dayPlans.forEach((plan, dayIndex) => {
    const dayDate = addDays(weekStart, dayIndex);
    const dateKey = tehranDateKey(dayDate);
    const kandakatorId = `kandakator-${dateKey}`;
    let matchCounter = 0;
    const matches: MemoryKandakator["matches"] = [];

    for (const leagueBlock of plan.leagues) {
      for (const [home, away, hour, minute] of leagueBlock.fixtures) {
        matchCounter += 1;
        const kickoff = tehranKickoffAt(dateKey, hour, minute);
        const matchId = `match-${dateKey}-${matchCounter}`;
        matches.push({
          id: `km-${dateKey}-${matchCounter}`,
          kandakatorId,
          matchId,
          sortOrder: matchCounter - 1,
          predictionCutoffMinutes: 5,
          match: createMatch(matchId, home, away, leagueBlock.league, kickoff),
        });
      }
    }

    map.set(dateKey, {
      id: kandakatorId,
      date: dayDate,
      title: plan.title,
      isPublished: true,
      entryFeeCoins: 600,
      matches,
    });
  });

  return map;
}

export function formatWeekDayLabel(date: Date) {
  return formatShamsiWeekday(date);
}

export function formatWeekDayShort(date: Date) {
  return formatShamsiShort(date);
}

export { tehranDateKey, TEHRAN_TZ };
