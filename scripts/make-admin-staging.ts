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
process.env.DEV_MEMORY_DB = "false";
for (const [key, value] of Object.entries(merged)) {
  process.env[key] = value;
}

const prisma = new PrismaClient();

async function main() {
  const phone = process.argv[2];
  if (!phone) {
    throw new Error("شماره موبایل را پاس بدهید. مثال: tsx scripts/make-admin-staging.ts 0912...");
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, phone: true, username: true, role: true },
  });

  if (!user) {
    console.log(`NOT_FOUND: ${phone}`);
    return;
  }

  console.log(`BEFORE: ${JSON.stringify(user)}`);
  const updated = await prisma.user.update({
    where: { phone },
    data: { role: "admin" },
    select: { id: true, phone: true, username: true, role: true },
  });
  console.log(`AFTER: ${JSON.stringify(updated)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
