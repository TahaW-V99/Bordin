#!/usr/bin/env node
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
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

async function main() {
  const prisma = createPrisma();
  const phone = "09376910074";

  const user = await prisma.user.findFirst({
    where: { phone: { in: [phone, "9376910074"] } },
    include: { profile: { select: { displayName: true } } },
  });
  console.log("user", user?.phone, user?.profile?.displayName, user?.id);

  const matches = await prisma.footballMatch.findMany({
    where: {
      OR: [
        { homeTeamName: { contains: "بلژ" } },
        { awayTeamName: { contains: "بلژ" } },
        { homeTeamName: { contains: "غنا" } },
        { awayTeamName: { contains: "غنا" } },
        { homeTeamName: { contains: "Belgium" } },
        { awayTeamName: { contains: "Belgium" } },
        { homeTeamName: { contains: "Ghana" } },
        { awayTeamName: { contains: "Ghana" } },
      ],
      kickoffAt: { gte: new Date("2026-06-28") },
    },
    orderBy: { kickoffAt: "asc" },
    take: 20,
  });

  for (const m of matches) {
    console.log(JSON.stringify({
      id: m.id,
      home: m.homeTeamName,
      away: m.awayTeamName,
      kickoffAt: m.kickoffAt.toISOString(),
      status: m.status,
    }));
  }

  if (user) {
    const preds = await prisma.prediction.findMany({
      where: { userId: user.id, competitionType: "DAILY" },
      include: { match: true },
      orderBy: { submittedAt: "desc" },
      take: 10,
    });
    for (const p of preds) {
      console.log("pred", p.homePrediction, p.awayPrediction, p.match.homeTeamName, p.match.awayTeamName, p.match.kickoffAt.toISOString());
    }
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
