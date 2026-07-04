import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { WHEEL_REWARD_OPTIONS } from "../src/shared/constants/wheel";

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

const target = process.argv.includes("--production") ? "production" : "staging";
const merged =
  target === "production"
    ? { ...parseEnvFile(".env") }
    : { ...parseEnvFile(".env.staging"), ...parseEnvFile(".env.staging.local") };

for (const [key, value] of Object.entries(merged)) {
  process.env[key] = value;
}

const prisma = new PrismaClient();

async function main() {
  await prisma.wheelRewardOption.deleteMany();
  for (let i = 0; i < WHEEL_REWARD_OPTIONS.length; i++) {
    const option = WHEEL_REWARD_OPTIONS[i];
    await prisma.wheelRewardOption.create({
      data: {
        coins: option.amount,
        weight: option.weight,
        sortOrder: i,
        isActive: true,
      },
    });
  }
  console.log(`Updated ${WHEEL_REWARD_OPTIONS.length} wheel reward options on ${target}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
