import { existsSync, readFileSync } from "node:fs";
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

const prisma = new PrismaClient();

async function main() {
  const phone = process.argv[2];
  const amount = Number(process.argv[3] ?? "20000");
  if (!phone) throw new Error("شماره موبایل لازم است.");
  if (!Number.isInteger(amount) || amount <= 0) throw new Error("مقدار سکه نامعتبر است.");

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { wallet: true },
  });
  if (!user?.wallet) {
    throw new Error("کاربر یا کیف پول یافت نشد.");
  }

  const before = user.wallet.predictionRewardCoins;
  const updated = await prisma.coinWallet.update({
    where: { userId: user.id },
    data: { predictionRewardCoins: { increment: amount } },
  });

  const totalBalance =
    updated.predictionRewardCoins + updated.systemRewardCoins + updated.purchasedCoins;
  await prisma.coinTransaction.create({
    data: {
      walletId: updated.id,
      coinType: CoinType.PREDICTION_REWARD,
      amount,
      balanceAfter: totalBalance,
      type: CoinTransactionType.ADMIN_ADJUSTMENT,
      description: `افزایش دستی ${amount} سکه قابل‌فروش در staging`,
    },
  });

  console.log(
    JSON.stringify(
      {
        phone,
        userId: user.id,
        beforePredictionRewardCoins: before,
        added: amount,
        afterPredictionRewardCoins: updated.predictionRewardCoins,
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
