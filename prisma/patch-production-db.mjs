/**
 * One-off production schema patch. Run on Liara:
 *   liara shell --app bordin --command "node prisma/patch-production-db.mjs"
 */
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

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

const statements = [
  `ALTER TABLE otp_sessions ADD COLUMN codeHash VARCHAR(191) NOT NULL DEFAULT ''`,
  `ALTER TABLE user_profiles ADD COLUMN teamCompetitionsEntered INT NOT NULL DEFAULT 0`,
  `ALTER TABLE teams ADD COLUMN isSuspended TINYINT(1) NOT NULL DEFAULT 0`,
  `ALTER TABLE teams ADD COLUMN suspendedAt DATETIME(3) NULL`,
  `ALTER TABLE team_competitions ADD COLUMN competitionType ENUM('ELIMINATION') NOT NULL DEFAULT 'ELIMINATION'`,
  `ALTER TABLE team_competitions ADD COLUMN minTeamSize INT NOT NULL DEFAULT 3`,
  `ALTER TABLE team_competitions ADD COLUMN maxTeamSize INT NOT NULL DEFAULT 5`,
  `ALTER TABLE team_competitions ADD COLUMN rankingStartsAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)`,
  `ALTER TABLE team_competitions ADD COLUMN rankingPredictionFeePerMember INT NOT NULL DEFAULT 0`,
  `ALTER TABLE team_competitions ADD COLUMN knockoutStartsAt DATETIME(3) NULL`,
  `ALTER TABLE team_competitions ADD COLUMN knockoutEndsAt DATETIME(3) NULL`,
  `ALTER TABLE team_competitions ADD COLUMN winnerEntryId VARCHAR(191) NULL`,
  `ALTER TABLE team_competitions ADD COLUMN runnerUpEntryId VARCHAR(191) NULL`,
  `ALTER TABLE team_competitions ADD COLUMN finishedAt DATETIME(3) NULL`,
  `ALTER TABLE team_competitions ADD COLUMN rewardsDistributedAt DATETIME(3) NULL`,
  `ALTER TABLE team_competitions ADD COLUMN rankingFinalizedAt DATETIME(3) NULL`,
  `ALTER TABLE team_competitions ADD COLUMN bracketGeneratedAt DATETIME(3) NULL`,
  `ALTER TABLE team_competition_entries ADD COLUMN seedRank INT NULL`,
  `ALTER TABLE team_competition_entries ADD COLUMN bracketSide ENUM('LEFT', 'RIGHT') NULL`,
  `ALTER TABLE team_competition_entries ADD COLUMN bracketGroupIndex INT NULL`,
  `ALTER TABLE team_competition_entries ADD COLUMN pairedEntryId VARCHAR(191) NULL`,
  `ALTER TABLE team_competition_entries ADD COLUMN knockoutRoundScore INT NOT NULL DEFAULT 0`,
  `ALTER TABLE otp_sessions ADD COLUMN referralCode VARCHAR(191) NULL`,
  `ALTER TABLE payment_transactions ADD COLUMN paymentMethod VARCHAR(191) NOT NULL DEFAULT 'zibal'`,
  `ALTER TABLE payment_transactions ADD COLUMN merchantId VARCHAR(191) NULL`,
  `ALTER TABLE payment_transactions ADD COLUMN zibalTrackId VARCHAR(191) NULL`,
  `ALTER TABLE payment_transactions ADD COLUMN zibalRefNumber VARCHAR(191) NULL`,
  `ALTER TABLE payment_transactions ADD COLUMN callbackPayload JSON NULL`,
  `ALTER TABLE payment_transactions ADD COLUMN verificationResponse JSON NULL`,
  `ALTER TABLE payment_transactions ADD COLUMN updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`,
  `CREATE TABLE IF NOT EXISTS team_competition_banner_assets (
    filename VARCHAR(191) NOT NULL,
    mimeType VARCHAR(191) NOT NULL,
    data LONGBLOB NOT NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (filename)
  )`,
];

async function main() {
  const prisma = createPrisma();
  for (const sql of statements) {
    try {
      await prisma.$executeRawUnsafe(sql);
      console.log("OK:", sql.slice(0, 72));
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("Duplicate column") || msg.includes("already exists")) {
        console.log("SKIP:", sql.slice(0, 72));
      } else {
        console.error("ERR:", msg, "\n ", sql.slice(0, 72));
      }
    }
  }

  await prisma.$disconnect();
  console.log("Production schema patch complete.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
