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
  const query = process.argv[2] ?? "taha";

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: { contains: query } },
        { profile: { displayName: { contains: query } } },
      ],
    },
    include: { profile: true },
    take: 30,
  });

  console.log(
    JSON.stringify(
      users.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.profile?.displayName,
        totalXp: u.profile?.totalXp,
        globalRank: u.profile?.globalRank,
      })),
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
