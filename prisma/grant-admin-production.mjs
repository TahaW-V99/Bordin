/**
 * Grant admin role on production. Run on Liara:
 *   liara shell --app bordin --command "node prisma/grant-admin-production.mjs 0901..."
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

function normalizePhone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("98") && digits.length === 12) return `0${digits.slice(2)}`;
  if (digits.startsWith("9") && digits.length === 10) return `0${digits}`;
  if (digits.startsWith("09") && digits.length === 11) return digits;
  return digits;
}

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

const phones = process.argv.slice(2);
if (phones.length === 0) {
  console.error("Usage: node prisma/grant-admin-production.mjs <phone> [phone...]");
  process.exit(1);
}

const prisma = createPrisma();

try {
  for (const rawPhone of phones) {
    const phone = normalizePhone(rawPhone);
    const user = await prisma.user.findUnique({
      where: { phone },
      select: { id: true, phone: true, username: true, role: true },
    });

    if (!user) {
      console.log(`NOT_FOUND: ${phone}`);
      continue;
    }

    console.log(`BEFORE: ${JSON.stringify(user)}`);
    const updated = await prisma.user.update({
      where: { phone },
      data: { role: "admin" },
      select: { id: true, phone: true, username: true, role: true },
    });
    console.log(`AFTER: ${JSON.stringify(updated)}`);
  }
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
