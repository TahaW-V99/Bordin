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
  `ALTER TABLE users ADD COLUMN lastSeenAt DATETIME(3) NULL`,
  `ALTER TABLE coin_transactions MODIFY COLUMN type ENUM(
    'SIGNUP_BONUS','PREDICTION_ENTRY','PREDICTION_REWARD','CUP_ENTRY','CUP_REWARD',
    'TOURNAMENT_ENTRY','TOURNAMENT_PREDICTION','TOURNAMENT_REWARD','TEAM_COMPETITION_ENTRY',
    'TEAM_COMPETITION_REWARD','TEAM_LOGO_PURCHASE','TEAM_FORMATION_FEE','TEAM_JOIN_FEE',
    'TEAM_RENAME_FEE','TEAM_REMOVE_MEMBER_FEE','TEAM_EXTRA_INVITE_FEE','TEAM_LEAVE_FEE',
    'WHEEL_REWARD','WHEEL_SPIN_COST','INVITE_REWARD','LEVEL_UP_REWARD','MISSION_REWARD',
    'PURCHASE','SELL','WITHDRAWAL','ADMIN_ADJUSTMENT','PROFILE_NAME_CHANGE',
    'PROFILE_AVATAR_PURCHASE','WATCH_PARTY_ENTRY'
  ) NOT NULL`,
  `ALTER TABLE notifications MODIFY COLUMN type ENUM(
    'REWARD','LEVEL_UP','MEDAL','COMPETITION','SYSTEM','INVITE','DISCOUNT',
    'PREDICTION_SETTLED','LEADERBOARD_RANK_UP','TEAM_LEADERBOARD_RANK_UP',
    'TEAM_INVITE','TEAM_MEMBER_LEFT','WATCH_PARTY_INVITE'
  ) NOT NULL`,
  `CREATE TABLE IF NOT EXISTS watch_party_rooms (
    id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    matchId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    googleMeetUrl TEXT NOT NULL,
    capacity INT NOT NULL,
    entryFeeCoins INT NOT NULL,
    isPublished TINYINT(1) NOT NULL DEFAULT 0,
    buttonForceActive TINYINT(1) NOT NULL DEFAULT 0,
    publishedAt DATETIME(3) NULL,
    createdById VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY watch_party_rooms_matchId_key (matchId),
    KEY watch_party_rooms_isPublished_idx (isPublished),
    CONSTRAINT watch_party_rooms_matchId_fkey FOREIGN KEY (matchId) REFERENCES football_matches(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT watch_party_rooms_createdById_fkey FOREIGN KEY (createdById) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS watch_party_entries (
    id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    roomId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    userId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    paidCoins INT NOT NULL,
    joinedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY watch_party_entries_roomId_userId_key (roomId, userId),
    KEY watch_party_entries_roomId_idx (roomId),
    KEY watch_party_entries_userId_idx (userId),
    CONSTRAINT watch_party_entries_roomId_fkey FOREIGN KEY (roomId) REFERENCES watch_party_rooms(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT watch_party_entries_userId_fkey FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `CREATE TABLE IF NOT EXISTS watch_party_invites (
    id VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    roomId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    inviterId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    inviteeId VARCHAR(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
    pushSentAt DATETIME(3) NULL,
    smsSentAt DATETIME(3) NULL,
    dismissedAt DATETIME(3) NULL,
    createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY watch_party_invites_roomId_inviterId_inviteeId_key (roomId, inviterId, inviteeId),
    KEY watch_party_invites_inviteeId_dismissedAt_idx (inviteeId, dismissedAt),
    CONSTRAINT watch_party_invites_roomId_fkey FOREIGN KEY (roomId) REFERENCES watch_party_rooms(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT watch_party_invites_inviterId_fkey FOREIGN KEY (inviterId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT watch_party_invites_inviteeId_fkey FOREIGN KEY (inviteeId) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
  `ALTER TABLE watch_party_rooms ADD COLUMN buttonForceActive TINYINT(1) NOT NULL DEFAULT 0`,
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
