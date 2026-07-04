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
const q = process.argv[2] ?? "10558858";

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { phone: q },
        { phone: { contains: q } },
      ],
    },
    include: { profile: true, wallet: true },
  });
  for (const u of users) {
    const spins = await prisma.wheelSpin.count({ where: { userId: u.id } });
    console.log(JSON.stringify({ phone: u.phone, id: u.id, displayName: u.profile?.displayName, systemCoins: u.wallet?.systemRewardCoins, spins }, null, 2));
  }
}

main().finally(() => prisma.$disconnect());
