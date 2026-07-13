#!/usr/bin/env node
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const u = new URL(process.env.DATABASE_URL);
const prisma = new PrismaClient({
  adapter: new PrismaMariaDb({
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.slice(1),
  }),
});

const bannerUrl = "/api/team-competition-banners/29160c69-51ce-40c9-a262-c9a27ee52a56.jpg";

const WORLD_CUP_COMPETITION_ID = "cmr1ykqvp00g50imxjuhofa4s";

const comp = await prisma.teamCompetition.findUnique({
  where: { id: WORLD_CUP_COMPETITION_ID },
  select: { id: true, bannerUrl: true, titleFa: true },
});

if (!comp) {
  console.log("competition not found");
  process.exit(1);
}

const asset = await prisma.teamCompetitionBannerAsset.findUnique({
  where: { filename: "29160c69-51ce-40c9-a262-c9a27ee52a56.jpg" },
  select: { filename: true },
});

if (!asset) {
  console.log("banner asset missing in DB");
  process.exit(1);
}

await prisma.teamCompetition.update({
  where: { id: comp.id },
  data: { bannerUrl },
});

console.log(JSON.stringify({ ok: true, from: comp.bannerUrl, to: bannerUrl }));
await prisma.$disconnect();
