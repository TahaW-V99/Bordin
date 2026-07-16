import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

/**
 * One-off: move all predictionRewardCoins into systemRewardCoins (raw wallet update).
 *
 *   liara shell --app bordin --command "node prisma/migrate-prediction-coins-to-system.mjs"
 */
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

async function main() {
  const prisma = createPrisma();
  try {
    const before = await prisma.coinWallet.aggregate({
      _sum: { predictionRewardCoins: true, systemRewardCoins: true },
      _count: { _all: true },
    });

    const affected = await prisma.$executeRaw`
      UPDATE coin_wallets
      SET systemRewardCoins = systemRewardCoins + predictionRewardCoins,
          predictionRewardCoins = 0
      WHERE predictionRewardCoins > 0
    `;

    const after = await prisma.coinWallet.aggregate({
      _sum: { predictionRewardCoins: true, systemRewardCoins: true },
    });

    console.log(
      JSON.stringify(
        {
          event: "migrate_prediction_coins_to_system",
          walletsTotal: before._count._all,
          walletsUpdated: Number(affected),
          before: before._sum,
          after: after._sum,
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
