import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

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
for (const [key, value] of Object.entries(merged)) {
  process.env[key] = value;
}

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      profile: true,
      xpTransactions: { where: { description: "پاداش ثبت‌نام" }, take: 1 },
    },
  });

  console.log(
    JSON.stringify(
      users.map((u) => ({
        id: u.id.slice(0, 8),
        phone: u.phone,
        createdAt: u.createdAt,
        totalXp: u.profile?.totalXp,
        signupXpTx: u.xpTransactions[0]?.amount ?? null,
      })),
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
