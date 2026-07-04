#!/usr/bin/env node
/**
 * Broadcast the limited-time unlimited invite reward announcement.
 *
 * Examples:
 *   liara shell --app bordintest --command "node prisma/send-invite-unlimited-announcement.mjs"
 *   liara shell --app bordin --command "node prisma/send-invite-unlimited-announcement.mjs"
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

const TITLE = "سقف دعوت به بُردین تا پایان ۱۵ تیرماه، بدون محدودیت شد!";
const BODY =
  "تا پایان ۱۵ تیرماه فرصت داری که بدون محدودیت، به ازای هر نفر که دعوت میکنی سکه و امتیاز بگیری. بعد از این مهلت، فقط برای دعوت ۱۰ نفر جایزه میگیری!";
const OLD_TITLE = "سقف دعوت به بُردین تا پایان ۱۶ تیرماه، بدون محدودیت شد!";
const OLD_BODY =
  "تا پایان ۱۶ تیرماه فرصت داری که بدون محدودیت، به ازای هر نفر که دعوت میکنی سکه و امتیاز بگیری. بعد از این مهلت، فقط برای دعوت ۱۰ نفر جایزه میگیری!";
const LINK = "/invite";
const SECONDARY_LABEL = "نشونم بده";
const CHUNK_SIZE = 500;

async function main() {
  const fixed = await prisma.notification.updateMany({
    where: {
      category: NotificationCategory.ANNOUNCEMENT,
      titleFa: OLD_TITLE,
      bodyFa: OLD_BODY,
    },
    data: {
      titleFa: TITLE,
      bodyFa: BODY,
      link: LINK,
      secondaryLink: LINK,
      secondaryLinkLabelFa: SECONDARY_LABEL,
    },
  });

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
        updated: fixed.count,
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
