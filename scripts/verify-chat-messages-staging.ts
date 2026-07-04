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

const merged = {
  ...parseEnvFile(".env.staging"),
  ...parseEnvFile(".env.staging.local"),
};
process.env.DEV_MEMORY_DB = "false";
for (const [key, value] of Object.entries(merged)) {
  process.env[key] = value;
}

const prisma = new PrismaClient();
const PHONE = "09010558858";

async function main() {
  const user = await prisma.user.findUnique({
    where: { phone: PHONE },
    include: { profile: true },
  });
  console.log("User:", user?.id, user?.profile?.displayName);

  const systemMsgs = await prisma.chatMessage.findMany({
    where: { roomSlug: "PUBLIC", type: "SYSTEM" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, body: true, createdAt: true, userId: true, roomSlug: true, type: true, teamId: true },
  });
  console.log("\nRecent PUBLIC SYSTEM messages:", systemMsgs.length);
  for (const m of systemMsgs) {
    console.log(`- [${m.createdAt.toISOString()}] teamId=${m.teamId} ${m.body}`);
  }

  const tahaMsgs = await prisma.chatMessage.findMany({
    where: { body: { contains: "طاها" } },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { body: true, roomSlug: true, type: true, createdAt: true },
  });
  console.log("\nMessages containing طاها:", tahaMsgs);

  const allPublic = await prisma.chatMessage.count({ where: { roomSlug: "PUBLIC" } });
  console.log("\nTotal PUBLIC messages:", allPublic);

  const chatTable = await prisma.chatMessage.findFirst({
    orderBy: { createdAt: "desc" },
    select: { id: true, roomSlug: true, type: true, body: true, createdAt: true },
  });
  console.log("\nLatest chat message overall:", chatTable);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
