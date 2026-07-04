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
const queries = process.argv.slice(2);

async function main() {
  if (!queries.length) {
    throw new Error("حداقل یک نام برای جستجو لازم است.");
  }

  for (const q of queries) {
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { equals: q } },
          { username: { contains: q } },
          { profile: { displayName: { equals: q } } },
          { profile: { displayName: { contains: q } } },
        ],
      },
      include: { profile: true },
      take: 10,
    });

    console.log(`--- ${q} ---`);
    if (!users.length) {
      console.log("یافت نشد");
      continue;
    }

    for (const user of users) {
      console.log(
        JSON.stringify({
          phone: user.phone,
          username: user.username,
          displayName: user.profile?.displayName,
        }),
      );
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
