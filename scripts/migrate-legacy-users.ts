#!/usr/bin/env node
/**
 * Import legacy user data from scripts/data/legacy-users.json
 *
 * Prefer:
 *   npm run migrate:legacy-users
 *   npm run migrate:legacy-users:staging
 *
 * Low-level:
 *   npx tsx scripts/migrate-legacy-users.ts --remote
 *   npx tsx scripts/migrate-legacy-users.ts --remote path/to/custom.json
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { LegacyUserRow } from "../src/shared/types/legacy-user-import";

async function assertLegacyImportTableExists() {
  const { prisma } = await import("../src/shared/lib/prisma");
  try {
    await prisma.$queryRaw`SELECT 1 FROM legacy_user_imports LIMIT 1`;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("legacy_user_imports") || message.includes("does not exist")) {
      console.error("\n❌ جدول legacy_user_imports در دیتابیس فعلی وجود ندارد.\n");
      console.error("ابتدا اسکیما را روی همان دیتابیسی که می‌خواهید import کنید push کنید:\n");
      console.error("  npm run db:push              ← production (از طریق Liara)");
      console.error("  npm run db:push:staging      ← staging (نیاز به URL عمومی در .env.staging.local)\n");
      console.error("سپس دوباره import را اجرا کنید:\n");
      console.error("  npm run migrate:legacy-users");
      console.error("  npm run migrate:legacy-users:staging\n");
      process.exit(1);
    }
    throw error;
  }
  return prisma;
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--remote");
  const dataPath = resolve(process.cwd(), args[0] ?? "scripts/data/legacy-users.json");

  if (!existsSync(dataPath)) {
    throw new Error(`فایل داده یافت نشد: ${dataPath}`);
  }

  const prisma = await assertLegacyImportTableExists();
  const { runLegacyUserImport } = await import(
    "../src/server/services/legacy-user-import-service"
  );

  const rows = JSON.parse(readFileSync(dataPath, "utf8")) as LegacyUserRow[];
  const report = await runLegacyUserImport(rows);

  console.log(JSON.stringify(report, null, 2));
  console.log("\n--- Legacy User Import Summary ---");
  console.log(`Batch: ${report.importBatchId}`);
  console.log(`Total rows: ${report.totalRows}`);
  console.log(`Migrated existing users: ${report.migratedExistingUsers.length}`);
  console.log(`Pending users created: ${report.pendingUsersCreated.length}`);
  console.log(`Pending users updated: ${report.pendingUsersUpdated.length}`);
  console.log(`Already applied (skipped): ${report.alreadyAppliedSkipped.length}`);
  console.log(`Duplicate rows skipped: ${report.duplicateRowsSkipped.length}`);
  console.log(`Failed rows: ${report.failedRows.length}`);

  if (report.migratedExistingUsers.length > 0) {
    console.log("\nMigrated phones:", report.migratedExistingUsers.join(", "));
  }
  if (report.pendingUsersCreated.length > 0) {
    console.log("\nPending created phones:", report.pendingUsersCreated.join(", "));
  }
  if (report.pendingUsersUpdated.length > 0) {
    console.log("\nPending updated phones:", report.pendingUsersUpdated.join(", "));
  }
  if (report.failedRows.length > 0) {
    console.log("\nFailures:");
    for (const failure of report.failedRows) {
      console.log(`  ${failure.phone}: ${failure.error}`);
    }
    process.exitCode = 1;
  }

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
