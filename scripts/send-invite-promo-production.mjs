#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const PROMO_TITLE = "سقف دعوت به بُردین تا پایان ۱۵ تیرماه، بدون محدودیت شد!";
const PROMO_BODY =
  "تا پایان ۱۵ تیرماه فرصت داری که بدون محدودیت، به ازای هر نفر که دعوت میکنی سکه و امتیاز بگیری. بعد از این مهلت، فقط برای دعوت ۱۰ نفر جایزه میگیری!";
const PROMO_LINK = "/invite";
const PROMO_DEADLINE = new Date("2026-07-06T20:29:59.999Z");
const TRIGGER_NAME = "notify_invite_unlimited_promo_15tir_1405";

function parseEnvFile(path) {
  const env = {};
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

function createPrisma() {
  const merged = { ...parseEnvFile(".env"), ...parseEnvFile(".env.production.local") };
  const databaseUrl = merged.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL not found in .env.production.local");
  if (databaseUrl.includes("bordindbtest")) {
    throw new Error("Refusing to run on staging database");
  }

  const parsed = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
    connectTimeout: 15000,
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

try {
  const existingUsers = await prisma.user.count({
    where: { createdAt: { lte: PROMO_DEADLINE } },
  });

  const insertedForExisting = await prisma.$executeRaw`
    INSERT INTO notifications (
      id,
      userId,
      type,
      category,
      titleFa,
      bodyFa,
      link,
      secondaryLink,
      secondaryLinkLabelFa,
      isRead,
      createdAt
    )
    SELECT
      CONCAT('promo_', REPLACE(UUID(), '-', '')),
      u.id,
      'SYSTEM',
      'ANNOUNCEMENT',
      ${PROMO_TITLE},
      ${PROMO_BODY},
      ${PROMO_LINK},
      NULL,
      NULL,
      FALSE,
      NOW()
    FROM users u
    WHERE u.createdAt <= ${PROMO_DEADLINE}
      AND NOT EXISTS (
        SELECT 1
        FROM notifications n
        WHERE n.userId = u.id
          AND n.titleFa = ${PROMO_TITLE}
          AND n.bodyFa = ${PROMO_BODY}
      )
  `;

  try {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS \`${TRIGGER_NAME}\``);
  } catch {
    // ignore
  }

  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER \`${TRIGGER_NAME}\`
    AFTER INSERT ON users
    FOR EACH ROW
    INSERT INTO notifications (
      id,
      userId,
      type,
      category,
      titleFa,
      bodyFa,
      link,
      secondaryLink,
      secondaryLinkLabelFa,
      isRead,
      createdAt
    )
    SELECT
      CONCAT('promo_', REPLACE(UUID(), '-', '')),
      NEW.id,
      'SYSTEM',
      'ANNOUNCEMENT',
      ${JSON.stringify(PROMO_TITLE)},
      ${JSON.stringify(PROMO_BODY)},
      ${JSON.stringify(PROMO_LINK)},
      NULL,
      NULL,
      FALSE,
      NOW()
    WHERE NEW.createdAt <= ${JSON.stringify(PROMO_DEADLINE.toISOString().slice(0, 19).replace("T", " "))};
  `);

  console.log(
    JSON.stringify(
      {
        ok: true,
        eligibleExistingUsers: existingUsers,
        insertedForExisting: Number(insertedForExisting),
        trigger: TRIGGER_NAME,
        deadline: PROMO_DEADLINE.toISOString(),
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}
