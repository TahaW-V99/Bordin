/**
 * Grant admin role on production. Run on Liara:
 *   liara shell --app bordin --command "node scripts/make-admin-production.mjs 0901..."
 *
 * Or locally if DATABASE_URL points at production (public host):
 *   node scripts/make-admin-production.mjs 0901...
 */
import { PrismaClient } from "@prisma/client";

const phones = process.argv.slice(2);
if (phones.length === 0) {
  console.error("Usage: node scripts/make-admin-production.mjs <phone> [phone...]");
  process.exit(1);
}

const prisma = new PrismaClient();

try {
  for (const phone of phones) {
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
