import { existsSync, readFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient, CoinTransactionType, CoinType } from "@prisma/client";

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

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is not configured for staging");

const parsedUrl = new URL(databaseUrl);
const adapter = new PrismaMariaDb({
  host: parsedUrl.hostname,
  port: parsedUrl.port ? Number(parsedUrl.port) : 3306,
  user: decodeURIComponent(parsedUrl.username),
  password: decodeURIComponent(parsedUrl.password),
  database: parsedUrl.pathname.replace(/^\//, ""),
});

const prisma = new PrismaClient({ adapter });

type GrantKind = "prediction" | "system" | "both";

async function grant(
  walletId: string,
  coinType: CoinType,
  field: "predictionRewardCoins" | "systemRewardCoins",
  amount: number,
  label: string,
) {
  const wallet = await prisma.coinWallet.update({
    where: { id: walletId },
    data: { [field]: { increment: amount } },
  });
  const totalBalance =
    wallet.predictionRewardCoins + wallet.systemRewardCoins + wallet.purchasedCoins;
  await prisma.coinTransaction.create({
    data: {
      walletId: wallet.id,
      coinType,
      amount,
      balanceAfter: totalBalance,
      type: CoinTransactionType.ADMIN_ADJUSTMENT,
      description: `افزایش دستی ${amount} ${label} در staging`,
    },
  });
  return wallet;
}

async function main() {
  const phone = process.argv[2];
  const amount = Number(process.argv[3] ?? "0");
  const kind = (process.argv[4] ?? "both") as GrantKind;

  if (!phone) throw new Error("شماره موبایل لازم است.");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("مقدار سکه نامعتبر است.");

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { wallet: true, profile: true },
  });
  if (!user?.wallet) throw new Error("کاربر یا کیف پول یافت نشد.");

  const before = {
    predictionRewardCoins: user.wallet.predictionRewardCoins,
    systemRewardCoins: user.wallet.systemRewardCoins,
  };

  let wallet = user.wallet;
  if (kind === "prediction" || kind === "both") {
    wallet = await grant(
      wallet.id,
      CoinType.PREDICTION_REWARD,
      "predictionRewardCoins",
      amount,
      "سکه قابل‌فروش",
    );
  }
  if (kind === "system" || kind === "both") {
    wallet = await grant(
      wallet.id,
      CoinType.SYSTEM_REWARD,
      "systemRewardCoins",
      amount,
      "سکه سیستمی",
    );
  }

  console.log(
    JSON.stringify(
      {
        phone,
        userId: user.id,
        displayName: user.profile?.displayName ?? null,
        added: amount,
        kind,
        before,
        after: {
          predictionRewardCoins: wallet.predictionRewardCoins,
          systemRewardCoins: wallet.systemRewardCoins,
          totalCoins:
            wallet.predictionRewardCoins +
            wallet.systemRewardCoins +
            wallet.purchasedCoins,
        },
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
