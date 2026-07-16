import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const matches = await prisma.footballMatch.findMany({
    where: {
      kickoffAt: {
        gte: new Date("2026-07-13T12:00:00.000Z"),
        lte: new Date("2026-07-15T23:59:59.000Z"),
      },
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      predictions: {
        select: {
          id: true,
          accuracyPercent: true,
          homePrediction: true,
          awayPrediction: true,
          rewardCoins: true,
        },
      },
    },
  });

  const target = matches.filter((m) => {
    const text = [
      m.homeTeam.name,
      m.awayTeam.name,
      m.homeTeam.nameEn ?? "",
      m.awayTeam.nameEn ?? "",
    ]
      .join(" ")
      .toLowerCase();
    return text.includes("france") || text.includes("spain") || text.includes("فرانسه") || text.includes("اسپانیا");
  });

  console.log(
    JSON.stringify(
      target.map((m) => ({
        id: m.id,
        kickoffAt: m.kickoffAt,
        status: m.status,
        home: m.homeTeam.name,
        away: m.awayTeam.name,
        homeScore: m.homeScore,
        awayScore: m.awayScore,
        predictionCount: m.predictions.length,
        unsettled: m.predictions.filter((p) => p.accuracyPercent == null).length,
        predictions: m.predictions,
      })),
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
