#!/usr/bin/env node
/**
 * Broadcast watch party feature announcement to all users.
 *
 * Examples:
 *   liara shell --app bordin --command "node prisma/send-watch-party-announcement.mjs"
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { NotificationCategory, NotificationType, PrismaClient } from "@prisma/client";

function createPrisma() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not configured");
  const parsed = new URL(databaseUrl);
  const adapter = new PrismaMariaDb({
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.replace(/^\//, ""),
  });
  return new PrismaClient({ adapter });
}

const prisma = createPrisma();

const TITLE = "تماشای گروهی مسابقات فوتبال به بُردین اضافه شد!";
const BODY =
  'دیدن مسابقه فوتبال با رفقا یک صفای دیگه‌ای داره! از این به بعد میتونی با کلیک روی دکمه "تماشای گروهی" به صورت آنلاین مسابقات رو با دوستانت تماشا کنی. توجه کن که ۳۰ دقیقه قبل از شروع شدن یک مسابقه میتونی وارد اتاق آنلاین بشی. میتونی حتی دوستات رو هم خبر کنی که باهم مسابقه رو تماشا کنید. ولی قبلش باید در بُردین ثبت نام کرده باشن';
const LINK = "/home?highlightWatchParty=1";
const SECONDARY_LABEL = "نشانم بده";
const CHUNK_SIZE = 500;

async function main() {
  const users = await prisma.user.findMany({ select: { id: true } });
  const existing = await prisma.notification.findMany({
    where: {
      category: NotificationCategory.ANNOUNCEMENT,
      titleFa: TITLE,
      bodyFa: BODY,
    },
    select: { userId: true },
  });

  const existingUserIds = new Set(existing.map((row) => row.userId));
  const rows = users
    .filter((user) => !existingUserIds.has(user.id))
    .map((user) => ({
      userId: user.id,
      type: NotificationType.SYSTEM,
      category: NotificationCategory.ANNOUNCEMENT,
      titleFa: TITLE,
      bodyFa: BODY,
      link: LINK,
      secondaryLink: LINK,
      secondaryLinkLabelFa: SECONDARY_LABEL,
      isRead: false,
    }));

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    await prisma.notification.createMany({ data: rows.slice(i, i + CHUNK_SIZE) });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        totalUsers: users.length,
        alreadyHadAnnouncement: existingUserIds.size,
        inserted: rows.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
