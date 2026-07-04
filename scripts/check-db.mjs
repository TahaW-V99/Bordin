import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const tables = await prisma.$queryRawUnsafe("SHOW TABLES");
  console.log("TABLES", JSON.stringify(tables));
  const count = await prisma.otpSession.count();
  console.log("OTP_SESSIONS_COUNT", count);
} catch (error) {
  console.error("DB_ERROR", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
