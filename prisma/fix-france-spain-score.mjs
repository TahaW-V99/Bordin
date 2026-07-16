/**
 * One-off: France 0-2 Spain (2026-07-14 kandakator) — VictoryAPI quota blocked sync.
 *   liara shell --app bordin --command "node prisma/fix-france-spain-score.mjs"
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  const parsed = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  });
  return new PrismaClient({ adapter });
}

function normalize(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function teamMatches(name, aliases) {
  const hay = normalize(name);
  return aliases.some((alias) => hay.includes(normalize(alias)));
}

function isFranceSpain(match) {
  const home = match.homeTeamName ?? "";
  const away = match.awayTeamName ?? "";
  const france = ["فرانسه", "france"];
  const spain = ["اسپانیا", "spain"];
  return (
    (teamMatches(home, france) && teamMatches(away, spain)) ||
    (teamMatches(home, spain) && teamMatches(away, france))
  );
}

async function main() {
  const prisma = createPrisma();
  try {
    const dayStart = new Date("2026-07-14T00:00:00.000Z");
    const dayEnd = new Date("2026-07-15T00:00:00.000Z");

    const rows = await prisma.footballMatch.findMany({
      where: {
        kickoffAt: { gte: dayStart, lt: dayEnd },
        kandakatorMatches: { some: { kandakator: { isPublished: true } } },
      },
      include: {
        kandakatorMatches: {
          include: { kandakator: { select: { id: true, date: true } } },
        },
      },
    });

    const match = rows.find(isFranceSpain);
    if (!match) {
      throw new Error("France vs Spain match not found on 2026-07-14 kandakator");
    }

    const franceHome = teamMatches(match.homeTeamName ?? "", ["فرانسه", "france"]);
    const homeScore = franceHome ? 0 : 2;
    const awayScore = franceHome ? 2 : 0;

    const before = {
      id: match.id,
      homeTeamName: match.homeTeamName,
      awayTeamName: match.awayTeamName,
      status: match.status,
      homeScore: match.homeScore,
      awayScore: match.awayScore,
    };

    if (
      match.status === "FINISHED" &&
      match.homeScore === homeScore &&
      match.awayScore === awayScore
    ) {
      console.log(JSON.stringify({ event: "already_correct", before }, null, 2));
      return;
    }

    await prisma.footballMatch.update({
      where: { id: match.id },
      data: {
        homeScore,
        awayScore,
        status: "FINISHED",
        scoresUpdatedAt: new Date(),
      },
    });

    console.log(
      JSON.stringify(
        {
          event: "score_updated",
          franceHome,
          before,
          after: { homeScore, awayScore, status: "FINISHED" },
          kandakatorIds: match.kandakatorMatches.map((row) => row.kandakator.id),
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
