import { existsSync, readFileSync } from "node:fs";
import { subDays } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { PrismaClient } from "@prisma/client";
import { TEHRAN_TZ } from "@/shared/lib/dates";
import { calculateWheelSpinCost } from "@/shared/lib/wheel-cost";
import { getLastThreeTehranDayKeys, tehranDayBounds } from "@/shared/lib/wheel-daily-coins";
import { WHEEL_COST_SPIN_INTERVAL } from "@/shared/constants/wheel";

function parseEnvFile(path: string) {
  const env: Record<string, string> = {};
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const merged = { ...parseEnvFile(".env.staging"), ...parseEnvFile(".env.staging.local") };
process.env.DEV_MEMORY_DB = "false";
for (const [key, value] of Object.entries(merged)) process.env[key] = value;

const prisma = new PrismaClient();

function tehranAt(daysAgo: number, hour: number, minute = 0) {
  const tehranNow = toZonedTime(new Date(), TEHRAN_TZ);
  const dateKey = formatInTimeZone(subDays(tehranNow, daysAgo), TEHRAN_TZ, "yyyy-MM-dd");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return fromZonedTime(`${dateKey}T${hh}:${mm}:00`, TEHRAN_TZ);
}

function parseDailyAmounts(raw: string | undefined) {
  if (!raw) return null;
  const amounts = raw.split(",").map((part) => Number(part.trim()));
  if (amounts.length !== 3 || amounts.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new Error("مقادیر روزانه باید سه عدد باشد، مثلاً 350,1200,300");
  }
  return amounts;
}

async function main() {
  const phone = process.argv[2];
  const dailyAmounts = parseDailyAmounts(process.argv[3]);
  if (!phone) throw new Error("شماره موبایل لازم است.");
  if (!dailyAmounts) throw new Error("مقادیر سه روز لازم است، مثلاً 350,1200,300");

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { wallet: true },
  });
  if (!user?.wallet) throw new Error("کاربر یا کیف پول یافت نشد.");

  const [day1Coins, day2Coins, day3Coins] = dailyAmounts;

  await prisma.wheelSpin.deleteMany({ where: { userId: user.id } });

  // پنجره ۳ روزه: [۲ روز پیش، دیروز، امروز]
  await prisma.wheelSpin.create({
    data: {
      userId: user.id,
      coinsWon: day1Coins,
      coinsCostApplied: 0,
      spunAt: tehranAt(2, 12),
    },
  });
  const spin2 = await prisma.wheelSpin.create({
    data: {
      userId: user.id,
      coinsWon: day2Coins,
      coinsCostApplied: 0,
      spunAt: tehranAt(1, 23),
    },
  });

  // آخرین چرخش شمارش‌شده باید حداقل ۲۶ ساعت قبل باشد تا cooldown رد شود.
  await prisma.wheelSpin.update({
    where: { id: spin2.id },
    data: { spunAt: new Date(Date.now() - 26 * 60 * 60 * 1000) },
  });
  // سکه روز سوم در تاریخچه درآمد (بدون شمارش چرخش) — روی دیروز تا cooldown امروز فعال نشود.
  await prisma.wheelSpin.create({
    data: {
      userId: user.id,
      coinsWon: day3Coins,
      coinsCostApplied: -1,
      spunAt: tehranAt(1, 7),
    },
  });

  const dayKeys = getLastThreeTehranDayKeys();
  const spins = await prisma.wheelSpin.findMany({
    where: { userId: user.id },
    select: { coinsWon: true, spunAt: true },
  });

  const wheelCoinsPerDay = dayKeys.map((dateKey) => {
    const { start, end } = tehranDayBounds(dateKey);
    return spins
      .filter((spin) => spin.spunAt >= start && spin.spunAt <= end)
      .reduce((sum, spin) => sum + spin.coinsWon, 0);
  });

  const wallet = await prisma.coinWallet.findUnique({ where: { userId: user.id } });
  if (!wallet) throw new Error("کیف پول یافت نشد.");

  const totalCoins =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;
  const calculatedCost = calculateWheelSpinCost(wheelCoinsPerDay);
  const spinCount = await prisma.wheelSpin.count({
    where: { userId: user.id, coinsCostApplied: { gte: 0 } },
  });
  const nextSpinNumber = spinCount + 1;
  const lastCountedSpin = await prisma.wheelSpin.findFirst({
    where: { userId: user.id, coinsCostApplied: { gte: 0 } },
    orderBy: { spunAt: "desc" },
  });
  const canSpinNow =
    !lastCountedSpin ||
    Date.now() - lastCountedSpin.spunAt.getTime() >= 24 * 60 * 60 * 1000;

  console.log(
    JSON.stringify(
      {
        phone,
        userId: user.id,
        dailyAmounts,
        priorSpins: spinCount,
        nextSpinNumber,
        isCostSpin: nextSpinNumber % WHEEL_COST_SPIN_INTERVAL === 0,
        wheelCoinsLast3Days: wheelCoinsPerDay,
        wheelCoinsTotal: wheelCoinsPerDay.reduce((a, b) => a + b, 0),
        calculatedCost,
        totalCoins,
        canApplyCost: calculatedCost > 0 && totalCoins > calculatedCost,
        canSpinNow,
        lastCountedSpinAt: lastCountedSpin?.spunAt.toISOString() ?? null,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
