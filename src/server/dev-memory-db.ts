/**
 * In-process store for local development when MySQL is not available.
 * Enable with DEV_MEMORY_DB=true in .env (used automatically with SMS_MOCK_MODE).
 */
import { createCompetitionSeedData } from "@/server/memory/competition-data";
import { buildWeekKandakators, tehranDateKey } from "@/server/memory/kandakator-seed";
import { REWARD_TABLES } from "@/shared/constants/reward-tables";
import { OTP_RATE_LIMIT_WINDOW_MS } from "@/shared/constants/auth";
import { DEFAULT_AVATAR_ID } from "@/shared/constants/settings";
import { formatShamsiFromDateKey } from "@/shared/lib/dates";
import { localizeFootballMatch } from "@/shared/lib/football-names-fa";
import { calculatePredictionAccuracy } from "@/shared/lib/prediction-accuracy";
import { serializeKickoffAt } from "@/shared/lib/dates";
import { userNeedsDisplayName } from "@/shared/lib/kandakator-utils";
import { isLegacyInvitePlaceholderUser } from "@/shared/lib/legacy-invite-placeholder";
import { getRewardFromTable } from "@/shared/constants/reward-tables";
import type { PredictionResultItem } from "@/shared/types/prediction-results";
import { isPredictionSettled } from "@/shared/types/prediction-results";
import { tehranDayBounds } from "@/shared/lib/wheel-daily-coins";
import { normalizePhone } from "@/shared/lib/phone";
import { isInviteUnlimitedRewardPromoActive } from "@/shared/constants/invite";

export interface MemoryOtpSession {
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  referralCode: string | null;
}

export interface MemoryAuditEntry {
  phone: string;
  event: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

export interface MemoryUser {
  id: string;
  phone: string;
  passwordHash: string | null;
  username: string;
  onboardingComplete: boolean;
  role: string;
  failedPasswordAttempts: number;
  passwordLockedUntil: Date | null;
  createdAt: Date;
}

export interface MemoryWallet {
  id: string;
  userId: string;
  predictionRewardCoins: number;
  systemRewardCoins: number;
  purchasedCoins: number;
  cashBalanceToman: number;
}

export interface MemoryProfile {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  displayNameChangeCount: number;
  totalXp: number;
  currentLevelId: string | null;
  totalPredictions: number;
  perfectPredictions: number;
  cupsEntered: number;
  tournamentsEntered: number;
  teamCompetitionsEntered: number;
  showcaseSlug: string | null;
  globalRank: number | null;
  shebaDigits: string | null;
  shebaStatus: "NONE" | "PENDING_ADMIN" | "VERIFIED" | "REJECTED";
  shebaSubmittedAt: Date | null;
  shebaVerifiedAt: Date | null;
  shebaInquiryMatched: boolean | null;
}

export interface MemoryWithdrawal {
  id: string;
  userId: string;
  amountToman: number;
  status: "PENDING" | "PAID" | "REJECTED";
  bankInfo: { shebaDigits: string };
  createdAt: Date;
}

export interface MemorySellTransaction {
  id: string;
  userId: string;
  coinsSold: number;
  tomanValue: number;
  createdAt: Date;
}

export interface MemoryLevel {
  id: string;
  rank: number;
  nameFa: string;
  xpThreshold: number;
}

export interface MemoryKandakator {
  id: string;
  date: Date;
  title: string;
  isPublished: boolean;
  entryFeeCoins: number;
  matches: MemoryKandakatorMatch[];
}

export interface MemoryMatch {
  id: string;
  homeTeamName: string;
  awayTeamName: string;
  leagueName: string | null;
  kickoffAt: Date;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

export interface MemoryKandakatorMatch {
  id: string;
  kandakatorId: string;
  matchId: string;
  sortOrder: number;
  predictionCutoffMinutes: number;
  match: MemoryMatch;
}

export interface MemoryPrediction {
  id: string;
  userId: string;
  matchId: string;
  competitionType: string;
  competitionRefId: string;
  homePrediction: number;
  awayPrediction: number;
  entryFeeCoins: number;
  accuracyPercent: number | null;
  coinsEarned: number | null;
  xpEarned: number | null;
  medalId: string | null;
  submittedAt: Date;
  scoredAt: Date | null;
}

export interface MemoryNotification {
  id: string;
  userId: string;
  type: string;
  category: "MESSAGE" | "ANNOUNCEMENT" | "DISCOUNT";
  titleFa: string;
  bodyFa: string | null;
  link: string | null;
  secondaryLink: string | null;
  secondaryLinkLabelFa: string | null;
  isRead: boolean;
  createdAt: Date;
}

const g = globalThis as unknown as {
  __bordinDevDb?: {
    otpSessions: Map<string, MemoryOtpSession>;
    auditLogs: MemoryAuditEntry[];
    users: Map<string, MemoryUser>;
    usersByPhone: Map<string, string>;
    wallets: Map<string, MemoryWallet>;
    profiles: Map<string, MemoryProfile>;
    unlockedProfileAvatars: Map<string, Set<string>>;
    levels: MemoryLevel[];
    kandakators: Map<string, MemoryKandakator>;
    predictions: MemoryPrediction[];
    notifications: MemoryNotification[];
    signupBonus: number;
    dailyPredictionCost: number;
    competitionData: ReturnType<typeof createCompetitionSeedData>;
    withdrawals: MemoryWithdrawal[];
    sellTransactions: MemorySellTransaction[];
  };
};

function db() {
  if (!g.__bordinDevDb) {
    const competitionData = createCompetitionSeedData();

    g.__bordinDevDb = {
      otpSessions: new Map(),
      auditLogs: [],
      users: new Map(),
      usersByPhone: new Map(),
      wallets: new Map(),
      profiles: new Map(),
      unlockedProfileAvatars: new Map(),
      levels: competitionData.levels,
      signupBonus: 900,
      dailyPredictionCost: 600,
      predictions: [],
      notifications: [],
      competitionData,
      kandakators: buildWeekKandakators(),
      withdrawals: [],
      sellTransactions: [],
    };
  }
  return g.__bordinDevDb;
}

import { DEV_TEST_GRANTS } from "@/server/dev-test-medals-config";

function grantDevTestMedals(userId: string, phone: string) {
  const normalized = normalizePhone(phone);
  for (const grant of DEV_TEST_GRANTS) {
    if (normalizePhone(grant.phone) === normalized) {
      devMemoryDb.medals.award(userId, grant.slug, "");
    }
  }
}

export function isDevMemoryDbEnabled() {
  if (process.env.NODE_ENV === "production") return false;
  return (
    process.env.DEV_MEMORY_DB === "true" ||
    (process.env.SMS_MOCK_MODE === "true" && process.env.DEV_MEMORY_DB !== "false")
  );
}

export const devMemoryDb = {
  otp: {
    deleteMany(phone: string) {
      db().otpSessions.delete(phone);
    },
    create(phone: string, codeHash: string, expiresAt: Date, referralCode?: string | null) {
      db().otpSessions.set(phone, {
        codeHash,
        expiresAt,
        attempts: 0,
        referralCode: referralCode?.trim() || null,
      });
    },
    findLatest(phone: string) {
      return db().otpSessions.get(phone) ?? null;
    },
    incrementAttempts(phone: string) {
      const s = db().otpSessions.get(phone);
      if (s) s.attempts += 1;
    },
    delete(phone: string) {
      db().otpSessions.delete(phone);
    },
  },
  user: {
    findByPhone(phone: string) {
      const id = db().usersByPhone.get(phone);
      return id ? db().users.get(id) ?? null : null;
    },
    findById(id: string) {
      return db().users.get(id) ?? null;
    },
    findByUsername(username: string) {
      const normalized = username.trim();
      if (!normalized) return null;
      for (const user of db().users.values()) {
        if (user.username === normalized) return user;
      }
      return null;
    },
    /** Restore user + profile + wallet from JWT after dev server restart. */
    ensureFromSession(userId: string, phone: string) {
      const existing = db().users.get(userId);
      if (existing) {
        if (!db().wallets.get(userId)) {
          db().wallets.set(userId, {
            id: `wallet-${userId}`,
            userId,
            predictionRewardCoins: 0,
            systemRewardCoins: db().signupBonus,
            purchasedCoins: 0,
            cashBalanceToman: 0,
          });
        }
        if (!db().profiles.get(userId)) {
          db().profiles.set(userId, {
            id: `profile-${userId}`,
            userId,
            displayName: phone,
            avatarUrl: DEFAULT_AVATAR_ID,
            displayNameChangeCount: 0,
            totalXp: 0,
            currentLevelId: db().levels[0]?.id ?? null,
            totalPredictions: 0,
            perfectPredictions: 0,
            cupsEntered: 0,
            tournamentsEntered: 0,
            teamCompetitionsEntered: 0,
            showcaseSlug: `user-${phone.slice(-4)}`,
            globalRank: null,
            shebaDigits: null,
            shebaStatus: "NONE",
            shebaSubmittedAt: null,
            shebaVerifiedAt: null,
            shebaInquiryMatched: null,
          });
        }
        grantDevTestMedals(userId, phone);
        return existing;
      }

      const mappedId = db().usersByPhone.get(phone);
      if (mappedId && mappedId !== userId) {
        return null;
      }

      const user: MemoryUser = {
        id: userId,
        phone,
        passwordHash: null,
        username: `user_${phone.slice(-4)}`,
        onboardingComplete: true,
        role: phone === "09120000000" ? "admin" : "user",
        failedPasswordAttempts: 0,
        passwordLockedUntil: null,
        createdAt: new Date(),
      };
      const wallet: MemoryWallet = {
        id: `wallet-${userId}`,
        userId,
        predictionRewardCoins: 0,
        systemRewardCoins: db().signupBonus,
        purchasedCoins: 0,
        cashBalanceToman: 0,
      };
      const profile: MemoryProfile = {
        id: `profile-${userId}`,
        userId,
        displayName: phone,
        avatarUrl: DEFAULT_AVATAR_ID,
        displayNameChangeCount: 0,
        totalXp: 50,
        currentLevelId: db().levels[0]?.id ?? null,
        totalPredictions: 0,
        perfectPredictions: 0,
        cupsEntered: 0,
        tournamentsEntered: 0,
        teamCompetitionsEntered: 0,
        showcaseSlug: `user-${phone.slice(-4)}`,
        globalRank: null,
        shebaDigits: null,
        shebaStatus: "NONE",
        shebaSubmittedAt: null,
        shebaVerifiedAt: null,
        shebaInquiryMatched: null,
      };
      db().users.set(userId, user);
      db().usersByPhone.set(phone, userId);
      db().wallets.set(userId, wallet);
      db().profiles.set(userId, profile);
      grantDevTestMedals(userId, phone);
      return user;
    },
    create(phone: string) {
      const id = `user-${Date.now()}`;
      const user: MemoryUser = {
        id,
        phone,
        passwordHash: null,
        username: `user_${phone.slice(-4)}`,
        onboardingComplete: false,
        role: phone === "09120000000" ? "admin" : "user",
        failedPasswordAttempts: 0,
        passwordLockedUntil: null,
        createdAt: new Date(),
      };
      const wallet: MemoryWallet = {
        id: `wallet-${id}`,
        userId: id,
        predictionRewardCoins: 0,
        systemRewardCoins: db().signupBonus,
        purchasedCoins: 0,
        cashBalanceToman: 0,
      };
      const profile: MemoryProfile = {
        id: `profile-${id}`,
        userId: id,
        displayName: phone,
        avatarUrl: DEFAULT_AVATAR_ID,
        displayNameChangeCount: 0,
        totalXp: 50,
        currentLevelId: db().levels[0]?.id ?? null,
        totalPredictions: 0,
        perfectPredictions: 0,
        cupsEntered: 0,
        tournamentsEntered: 0,
        teamCompetitionsEntered: 0,
        showcaseSlug: `user-${phone.slice(-4)}`,
        globalRank: null,
        shebaDigits: null,
        shebaStatus: "NONE",
        shebaSubmittedAt: null,
        shebaVerifiedAt: null,
        shebaInquiryMatched: null,
      };
      db().users.set(id, user);
      db().usersByPhone.set(phone, id);
      db().wallets.set(id, wallet);
      db().profiles.set(id, profile);
      return user;
    },
    updateLastLogin(id: string) {
      const u = db().users.get(id);
      if (u) db().users.set(id, u);
    },
    setOnboardingComplete(id: string) {
      const u = db().users.get(id);
      if (!u) return false;
      u.onboardingComplete = true;
      db().users.set(id, u);
      return true;
    },
    setPassword(id: string, hash: string) {
      const u = db().users.get(id);
      if (u) {
        u.passwordHash = hash;
        db().users.set(id, u);
      }
    },
    incrementFailedPassword(id: string) {
      const u = db().users.get(id);
      if (!u) return;
      u.failedPasswordAttempts += 1;
      if (u.failedPasswordAttempts >= 5) {
        u.passwordLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
      }
      db().users.set(id, u);
    },
    resetFailedPassword(id: string) {
      const u = db().users.get(id);
      if (!u) return;
      u.failedPasswordAttempts = 0;
      u.passwordLockedUntil = null;
      db().users.set(id, u);
    },
  },
  audit: {
    log(phone: string, event: string, ip?: string | null, metadata?: Record<string, unknown>) {
      db().auditLogs.push({ phone, event, ip, metadata, createdAt: new Date() });
    },
    countOtpSendsInWindow(phone: string) {
      const since = Date.now() - OTP_RATE_LIMIT_WINDOW_MS;
      return db().auditLogs.filter(
        (e) =>
          e.phone === phone &&
          (e.event === "OTP_SENT" || e.event === "OTP_RESENT") &&
          e.createdAt.getTime() >= since,
      ).length;
    },
  },
  wallet: {
    getByUserId(userId: string) {
      return db().wallets.get(userId) ?? null;
    },
    deductForPrediction(userId: string, amount: number) {
      const w = db().wallets.get(userId);
      if (!w) throw new Error("کیف پول یافت نشد");
      const total = w.predictionRewardCoins + w.systemRewardCoins + w.purchasedCoins;
      if (total < amount) throw new Error("موجودی سکه کافی نیست");

      let remaining = amount;
      const take = (field: keyof Pick<MemoryWallet, "purchasedCoins" | "systemRewardCoins" | "predictionRewardCoins">) => {
        const n = Math.min(w[field], remaining);
        w[field] -= n;
        remaining -= n;
      };
      take("purchasedCoins");
      take("systemRewardCoins");
      take("predictionRewardCoins");
      db().wallets.set(userId, w);
      return w;
    },
    addPredictionReward(userId: string, amount: number) {
      const w = db().wallets.get(userId);
      if (!w) throw new Error("کیف پول یافت نشد");
      w.predictionRewardCoins += amount;
      db().wallets.set(userId, w);
      return w;
    },
    adjustSystemReward(userId: string, delta: number) {
      const w = db().wallets.get(userId);
      if (!w) throw new Error("کیف پول یافت نشد");
      if (delta >= 0) {
        w.systemRewardCoins += delta;
      } else {
        w.systemRewardCoins = Math.max(0, w.systemRewardCoins + delta);
      }
      db().wallets.set(userId, w);
      return w;
    },
    addSystemReward(userId: string, amount: number) {
      const w = db().wallets.get(userId);
      if (!w) throw new Error("کیف پول یافت نشد");
      w.systemRewardCoins += amount;
      db().wallets.set(userId, w);
      return w;
    },
    tryDeductSystemReward(userId: string, amount: number) {
      const w = db().wallets.get(userId);
      if (!w || w.systemRewardCoins <= 0) return { applied: false, amount: 0 };
      if (w.systemRewardCoins - amount <= 0) return { applied: false, amount: 0 };
      w.systemRewardCoins -= amount;
      db().wallets.set(userId, w);
      return { applied: true, amount };
    },
    addPurchased(userId: string, amount: number) {
      const w = db().wallets.get(userId);
      if (!w) throw new Error("کیف پول یافت نشد");
      w.purchasedCoins += amount;
      db().wallets.set(userId, w);
      return w;
    },
    sellPredictionCoins(userId: string, coinAmount: number) {
      const w = db().wallets.get(userId);
      if (!w || w.predictionRewardCoins < coinAmount) {
        throw new Error("موجودی سکه قابل فروش کافی نیست");
      }
      const tomanValue = Math.floor(coinAmount * 45);
      w.predictionRewardCoins -= coinAmount;
      w.cashBalanceToman += tomanValue;
      db().wallets.set(userId, w);
      db().sellTransactions.push({
        id: `sell-${Date.now()}`,
        userId,
        coinsSold: coinAmount,
        tomanValue,
        createdAt: new Date(),
      });
      return { wallet: w, tomanValue };
    },
    addCash(userId: string, amount: number) {
      const w = db().wallets.get(userId);
      if (!w) throw new Error("کیف پول یافت نشد");
      w.cashBalanceToman += amount;
      db().wallets.set(userId, w);
      return w;
    },
    deductCash(userId: string, amount: number) {
      const w = db().wallets.get(userId);
      if (!w || w.cashBalanceToman < amount) throw new Error("موجودی کیف پول کافی نیست");
      w.cashBalanceToman -= amount;
      db().wallets.set(userId, w);
      return w;
    },
  },
  profile: {
    getByUserId(userId: string) {
      const p = db().profiles.get(userId);
      const level = p?.currentLevelId
        ? db().levels.find((l) => l.id === p.currentLevelId) ?? null
        : null;
      return p ? { ...p, currentLevel: level } : null;
    },
    getRaw(userId: string) {
      return db().profiles.get(userId) ?? null;
    },
    incrementPredictions(userId: string) {
      const p = db().profiles.get(userId);
      if (p) {
        p.totalPredictions += 1;
        db().profiles.set(userId, p);
      }
    },
    incrementPerfectPredictions(userId: string) {
      const p = db().profiles.get(userId);
      if (p) {
        p.perfectPredictions += 1;
        db().profiles.set(userId, p);
      }
    },
    addXp(userId: string, amount: number) {
      const p = db().profiles.get(userId);
      if (!p) return;
      p.totalXp += amount;
      const levels = [...db().levels].sort((a, b) => b.xpThreshold - a.xpThreshold);
      const level = levels.find((l) => p.totalXp >= l.xpThreshold);
      if (level) p.currentLevelId = level.id;
      db().profiles.set(userId, p);
      return p;
    },
    getAll() {
      return Array.from(db().profiles.values());
    },
    findBySlug(slug: string) {
      for (const p of db().profiles.values()) {
        if (p.showcaseSlug === slug) return p;
      }
      return null;
    },
    incrementCups(userId: string) {
      const p = db().profiles.get(userId);
      if (p) { p.cupsEntered += 1; db().profiles.set(userId, p); }
    },
    incrementTournaments(userId: string) {
      const p = db().profiles.get(userId);
      if (p) { p.tournamentsEntered += 1; db().profiles.set(userId, p); }
    },
    incrementTeamComps(userId: string) {
      const p = db().profiles.get(userId);
      if (p) { p.teamCompetitionsEntered += 1; db().profiles.set(userId, p); }
    },
    updateDisplayName(userId: string, displayName: string, changeCount: number) {
      const p = db().profiles.get(userId);
      if (!p) return;
      p.displayName = displayName;
      p.displayNameChangeCount = changeCount;
      db().profiles.set(userId, p);
    },
    updateAvatar(userId: string, avatarUrl: string) {
      const p = db().profiles.get(userId);
      if (!p) return;
      p.avatarUrl = avatarUrl;
      db().profiles.set(userId, p);
    },
    getUnlockedAvatarIds(userId: string) {
      return Array.from(db().unlockedProfileAvatars.get(userId) ?? []);
    },
    unlockAvatar(userId: string, avatarId: string) {
      const current = db().unlockedProfileAvatars.get(userId) ?? new Set<string>();
      current.add(avatarId);
      db().unlockedProfileAvatars.set(userId, current);
    },
  },
  kandakator: {
    getToday() {
      return db().kandakators.get(tehranDateKey(new Date())) ?? null;
    },
    getByDate(dateKey: string) {
      return db().kandakators.get(dateKey) ?? null;
    },
    listAll() {
      return Array.from(db().kandakators.values());
    },
    getById(id: string) {
      for (const k of db().kandakators.values()) {
        if (k.id === id) return k;
      }
      return null;
    },
    findMatchById(matchId: string) {
      for (const k of db().kandakators.values()) {
        for (const km of k.matches) {
          if (km.matchId === matchId || km.match.id === matchId) {
            return km.match;
          }
        }
      }
      const cd = db().competitionData;
      for (const cup of cd.cups) {
        if (cup.match?.id === matchId) return cup.match;
      }
      for (const t of cd.tournaments) {
        for (const tm of t.matches ?? []) {
          if (tm.match?.id === matchId) return tm.match;
        }
      }
      return null;
    },
    sameFixture(
      a: Pick<MemoryMatch, "homeTeamName" | "awayTeamName" | "kickoffAt">,
      b: Pick<MemoryMatch, "homeTeamName" | "awayTeamName" | "kickoffAt">,
    ) {
      return (
        a.homeTeamName === b.homeTeamName &&
        a.awayTeamName === b.awayTeamName &&
        Math.abs(a.kickoffAt.getTime() - b.kickoffAt.getTime()) <= 2 * 60 * 60 * 1000
      );
    },
    /** Merge API scores into existing day rows — preserves match IDs used by predictions. */
    mergeDayFromApi(
      dateKey: string,
      items: Array<{
        matchId: string;
        homeTeamName: string;
        awayTeamName: string;
        leagueName: string | null;
        kickoffAt: Date;
        homeScore: number | null;
        awayScore: number | null;
        status: string;
      }>,
    ) {
      const existing = db().kandakators.get(dateKey);
      if (!existing || existing.matches.length === 0) {
        devMemoryDb.kandakator.replaceDay(dateKey, items);
        return { merged: 0, added: items.length, preservedIds: 0, orderMerged: 0 };
      }

      const applyApiToRow = (
        km: MemoryKandakator["matches"][number],
        item: (typeof items)[number],
      ) => {
        km.match.homeTeamName = item.homeTeamName;
        km.match.awayTeamName = item.awayTeamName;
        km.match.leagueName = item.leagueName;
        km.match.kickoffAt = item.kickoffAt;
        km.match.homeScore = item.homeScore ?? km.match.homeScore;
        km.match.awayScore = item.awayScore ?? km.match.awayScore;
        km.match.status = item.status;
      };

      let merged = 0;
      let added = 0;
      let preservedIds = 0;
      let orderMerged = 0;
      const mergedRowIds = new Set<string>();
      const mergedItemIndexes = new Set<number>();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const km = existing.matches.find(
          (row) =>
            !mergedRowIds.has(row.id) &&
            devMemoryDb.kandakator.sameFixture(row.match, {
              homeTeamName: item.homeTeamName,
              awayTeamName: item.awayTeamName,
              kickoffAt: item.kickoffAt,
            }),
        );
        if (!km) continue;

        applyApiToRow(km, item);
        mergedRowIds.add(km.id);
        mergedItemIndexes.add(i);
        preservedIds += 1;
        merged += 1;
      }

      const unmergedRows = existing.matches
        .filter((row) => !mergedRowIds.has(row.id))
        .sort((a, b) => a.match.kickoffAt.getTime() - b.match.kickoffAt.getTime());
      const unmergedItems = items
        .map((item, index) => ({ item, index }))
        .filter(({ index }) => !mergedItemIndexes.has(index))
        .sort((a, b) => a.item.kickoffAt.getTime() - b.item.kickoffAt.getTime());

      for (let i = 0; i < Math.min(unmergedRows.length, unmergedItems.length); i++) {
        applyApiToRow(unmergedRows[i], unmergedItems[i].item);
        mergedRowIds.add(unmergedRows[i].id);
        mergedItemIndexes.add(unmergedItems[i].index);
        preservedIds += 1;
        merged += 1;
        orderMerged += 1;
      }

      for (let i = 0; i < items.length; i++) {
        if (mergedItemIndexes.has(i)) continue;
        const item = items[i];
        added += 1;
        const sortOrder = existing.matches.length;
        existing.matches.push({
          id: `km-${dateKey}-${sortOrder + 1}`,
          kandakatorId: existing.id,
          matchId: item.matchId,
          sortOrder,
          predictionCutoffMinutes: 5,
          match: {
            id: item.matchId,
            homeTeamName: item.homeTeamName,
            awayTeamName: item.awayTeamName,
            leagueName: item.leagueName,
            kickoffAt: item.kickoffAt,
            homeScore: item.homeScore,
            awayScore: item.awayScore,
            status: item.status,
          },
        });
      }

      db().kandakators.set(dateKey, existing);
      return { merged, added, preservedIds, orderMerged };
    },
    replaceDay(
      dateKey: string,
      items: Array<{
        matchId: string;
        homeTeamName: string;
        awayTeamName: string;
        leagueName: string | null;
        kickoffAt: Date;
        homeScore: number | null;
        awayScore: number | null;
        status: string;
      }>,
    ) {
      const kandakatorId = `kandakator-${dateKey}`;
      const dayDate = new Date(`${dateKey}T12:00:00+03:30`);
      const matches: MemoryKandakator["matches"] = items.map((item, index) => ({
        id: `km-${dateKey}-${index + 1}`,
        kandakatorId,
        matchId: item.matchId,
        sortOrder: index,
        predictionCutoffMinutes: 5,
        match: {
          id: item.matchId,
          homeTeamName: item.homeTeamName,
          awayTeamName: item.awayTeamName,
          leagueName: item.leagueName,
          kickoffAt: item.kickoffAt,
          homeScore: item.homeScore,
          awayScore: item.awayScore,
          status: item.status,
        },
      }));

      db().kandakators.set(dateKey, {
        id: kandakatorId,
        date: dayDate,
        title: `کنداکتور ${formatShamsiFromDateKey(dateKey)}`,
        isPublished: true,
        entryFeeCoins: 600,
        matches,
      });
    },
  },
  predictions: {
    findExisting(userId: string, matchId: string, kandakatorId: string) {
      return (
        db().predictions.find(
          (p) =>
            p.userId === userId &&
            p.matchId === matchId &&
            p.competitionRefId === kandakatorId,
        ) ?? null
      );
    },
    findExistingDaily(userId: string, matchId: string) {
      return (
        db().predictions.find(
          (p) =>
            p.userId === userId &&
            p.matchId === matchId &&
            p.competitionType === "DAILY",
        ) ?? null
      );
    },
    create(data: Omit<MemoryPrediction, "id" | "accuracyPercent" | "coinsEarned" | "xpEarned" | "medalId" | "submittedAt" | "scoredAt">) {
      const prediction: MemoryPrediction = {
        ...data,
        id: `pred-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        accuracyPercent: null,
        coinsEarned: null,
        xpEarned: null,
        medalId: null,
        submittedAt: new Date(),
        scoredAt: null,
      };
      db().predictions.push(prediction);
      return prediction;
    },
    listUnscoredForMatch(matchId: string) {
      return db().predictions.filter(
        (p) => p.matchId === matchId && p.scoredAt === null,
      );
    },
    listForMatch(matchId: string) {
      return db().predictions.filter((p) => p.matchId === matchId);
    },
    listUnscoredForUserSince(userId: string, since: Date) {
      return db().predictions.filter(
        (p) => p.userId === userId && p.scoredAt === null && p.submittedAt >= since,
      );
    },
    listSubmittedSince(userId: string, since: Date) {
      return db().predictions.filter(
        (p) => p.userId === userId && p.submittedAt >= since,
      );
    },
    coinsPerDayLast3(userId: string, dayKeys: string[]) {
      return dayKeys.map((dateKey) => {
        const { start, end } = tehranDayBounds(dateKey);
        return db()
          .predictions.filter(
            (p) =>
              p.userId === userId &&
              p.scoredAt &&
              p.scoredAt >= start &&
              p.scoredAt <= end &&
              (p.coinsEarned ?? 0) > 0,
          )
          .reduce((sum, p) => sum + (p.coinsEarned ?? 0), 0);
      });
    },
    sumCoinsSince(userId: string, since: Date) {
      return db()
        .predictions.filter(
          (p) => p.userId === userId && p.scoredAt && p.scoredAt >= since && (p.coinsEarned ?? 0) > 0,
        )
        .reduce((sum, p) => sum + (p.coinsEarned ?? 0), 0);
    },
    sumXpSince(userId: string, since: Date) {
      return db()
        .predictions.filter(
          (p) => p.userId === userId && p.scoredAt && p.scoredAt >= since && (p.xpEarned ?? 0) > 0,
        )
        .reduce((sum, p) => sum + (p.xpEarned ?? 0), 0);
    },
    listResultsForUser(userId: string, limit: number) {
      return db()
        .predictions.filter((p) => p.userId === userId)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
        .slice(0, limit)
        .map((p) => {
          const match = devMemoryDb.kandakator.findMatchById(p.matchId);
          return {
            id: p.id,
            homePrediction: p.homePrediction,
            awayPrediction: p.awayPrediction,
            entryFeeCoins: p.entryFeeCoins,
            accuracyPercent: p.accuracyPercent,
            coinsEarned: p.coinsEarned,
            xpEarned: p.xpEarned,
            scoredAt: p.scoredAt?.toISOString() ?? null,
            submittedAt: p.submittedAt.toISOString(),
            competitionType: p.competitionType,
            match: match
              ? {
                  id: match.id,
                  homeTeamName: match.homeTeamName,
                  awayTeamName: match.awayTeamName,
                  leagueName: match.leagueName,
                  kickoffAt: serializeKickoffAt(match.kickoffAt),
                  homeScore: match.homeScore,
                  awayScore: match.awayScore,
                  status: match.status,
                }
              : null,
          };
        })
        .filter((row) => row.match !== null);
    },
    score(input: {
      predictionId: string;
      userId: string;
      homePrediction: number;
      awayPrediction: number;
      actualHome: number;
      actualAway: number;
      rewardTableSlug: string;
    }) {
      const p = db().predictions.find((row) => row.id === input.predictionId);
      if (!p || p.scoredAt) return null;

      const accuracy = calculatePredictionAccuracy(
        input.homePrediction,
        input.awayPrediction,
        input.actualHome,
        input.actualAway,
      );
      const reward = getRewardFromTable(input.rewardTableSlug, accuracy);

      p.accuracyPercent = accuracy;
      p.coinsEarned = reward.coins;
      p.xpEarned = reward.xp;
      p.scoredAt = new Date();

      if (reward.coins > 0) {
        devMemoryDb.wallet.addSystemReward(input.userId, reward.coins);
      }
      if (reward.xp > 0) {
        devMemoryDb.profile.addXp(input.userId, reward.xp);
      }
      if (accuracy === 100) {
        devMemoryDb.profile.incrementPerfectPredictions(input.userId);
      }
      if (reward.medalSlug) {
        devMemoryDb.medals.award(input.userId, reward.medalSlug, "پاداش پیش‌بینی");
        const medal = db().competitionData.medals.find((m) => m.slug === reward.medalSlug);
        if (medal) p.medalId = medal.id;
      }

      return p;
    },
    listResultsLast7Days(
      userId: string,
      filter: "pending" | "settled",
      since: Date,
    ): PredictionResultItem[] {
      return db()
        .predictions.filter((p) => p.userId === userId && p.submittedAt >= since)
        .sort((a, b) => b.submittedAt.getTime() - a.submittedAt.getTime())
        .map((p) => {
          const match = devMemoryDb.kandakator.findMatchById(p.matchId);
          if (!match) return null;

          const medal = p.medalId
            ? db().competitionData.medals.find((m) => m.id === p.medalId)
            : null;
          const settled = isPredictionSettled({
            match: {
              id: match.id,
              homeTeamName: match.homeTeamName,
              awayTeamName: match.awayTeamName,
              leagueName: match.leagueName,
              kickoffAt: serializeKickoffAt(match.kickoffAt),
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              status: match.status,
            },
            scoredAt: p.scoredAt?.toISOString() ?? null,
          });
          const hasScore = match.homeScore !== null && match.awayScore !== null;
          const item: PredictionResultItem = {
            id: p.id,
            homePrediction: p.homePrediction,
            awayPrediction: p.awayPrediction,
            entryFeeCoins: p.entryFeeCoins,
            accuracyPercent:
              p.scoredAt !== null
                ? p.accuracyPercent
                : hasScore
                  ? calculatePredictionAccuracy(
                      p.homePrediction,
                      p.awayPrediction,
                      match.homeScore!,
                      match.awayScore!,
                    )
                  : p.accuracyPercent,
            coinsEarned: p.coinsEarned,
            xpEarned: p.xpEarned,
            scoredAt: p.scoredAt?.toISOString() ?? null,
            submittedAt: p.submittedAt.toISOString(),
            competitionType: p.competitionType,
            competitionRefId: p.competitionRefId ?? null,
            medal: medal
              ? { id: medal.id, titleFa: medal.titleFa, tier: medal.tier }
              : null,
            match: {
              id: match.id,
              homeTeamName: match.homeTeamName,
              awayTeamName: match.awayTeamName,
              leagueName: match.leagueName,
              kickoffAt: serializeKickoffAt(match.kickoffAt),
              homeScore: match.homeScore,
              awayScore: match.awayScore,
              status: match.status,
            },
          };
          return { settled, item };
        })
        .filter((row): row is { settled: boolean; item: PredictionResultItem } => row !== null)
        .filter((row) => (filter === "settled" ? row.settled : !row.settled))
        .map((row) => row.item);
    },
    listForKandakator(userId: string, kandakatorId: string) {
      return db().predictions.filter(
        (p) => p.userId === userId && p.competitionRefId === kandakatorId,
      );
    },
    listForDailyMatchIds(userId: string, matchIds: string[]) {
      if (matchIds.length === 0) return [];
      const idSet = new Set(matchIds);
      return db().predictions.filter(
        (p) =>
          p.userId === userId &&
          p.competitionType === "DAILY" &&
          idSet.has(p.matchId),
      );
    },
  },
  notifications: {
    create(data: Omit<MemoryNotification, "id" | "isRead" | "createdAt">) {
      const notification: MemoryNotification = {
        ...data,
        secondaryLink: data.secondaryLink ?? null,
        secondaryLinkLabelFa: data.secondaryLinkLabelFa ?? null,
        id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        isRead: false,
        createdAt: new Date(),
      };
      db().notifications.push(notification);
      return notification;
    },
    listForUser(userId: string, category?: MemoryNotification["category"]) {
      return db().notifications.filter(
        (n) => n.userId === userId && (!category || n.category === category),
      );
    },
    unreadCount(userId: string) {
      return db().notifications.filter((n) => n.userId === userId && !n.isRead).length;
    },
    markRead(userId: string, notificationId: string) {
      const row = db().notifications.find(
        (n) => n.id === notificationId && n.userId === userId,
      );
      if (!row) return null;
      row.isRead = true;
      return row;
    },
    ensureWelcome(userId: string) {
      if (
        db().notifications.some(
          (n) => n.userId === userId && n.titleFa === "به بُردین خوش آمدید",
        )
      ) {
        return;
      }
      db().notifications.push({
        id: `notif-${userId}-welcome`,
        userId,
        type: "SYSTEM",
        category: "MESSAGE",
        titleFa: "به بُردین خوش آمدید",
        bodyFa: "از این پس پیش‌بینی‌های روزانه، جام‌ها و تورنمنت‌ها را از همینجا دنبال کنید.",
        link: null,
        secondaryLink: null,
        secondaryLinkLabelFa: null,
        isRead: false,
        createdAt: new Date(),
      });
    },
    /** @deprecated */
    ensureSamples(userId: string) {
      devMemoryDb.notifications.ensureWelcome(userId);
    },
    dismissTeamInvite(userId: string, inviteId: string) {
      const needle = `inviteId=${inviteId}`;
      for (const row of db().notifications) {
        if (row.userId !== userId || row.type !== "TEAM_INVITE" || row.isRead) continue;
        if (row.link?.includes(needle) || row.secondaryLink?.includes(needle)) {
          row.isRead = true;
        }
      }
    },
  },
  config: {
    signupBonus: () => db().signupBonus,
    dailyPredictionCost: () => db().dailyPredictionCost,
  },
  competitions: {
    listCups(userId: string, filter: string) {
      const cd = db().competitionData;
      return cd.cups
        .map((c) => {
          const joined = cd.cupEntries.some((e) => e.cupId === c.id && e.userId === userId);
          const finished = new Date() > new Date(c.endsAt);
          const status = finished ? "finished" : joined ? "joined" : "upcoming";
          return { ...c, joined, status, match: c.match ? localizeFootballMatch(c.match) : c.match };
        })
        .filter((c) => {
          if (filter === "joined") return c.joined && c.status !== "finished";
          if (filter === "finished") return c.status === "finished";
          return !c.joined && c.status !== "finished";
        });
    },
    getCup(id: string, userId: string) {
      const cd = db().competitionData;
      const cup = cd.cups.find((c) => c.id === id);
      if (!cup) return null;
      const joined = cd.cupEntries.some((e) => e.cupId === id && e.userId === userId);
      const finished = new Date() > new Date(cup.endsAt);
      const prediction = db().predictions.find(
        (p) => p.userId === userId && p.competitionType === "CUP" && p.competitionRefId === id,
      );
      return {
        ...cup,
        match: cup.match ? localizeFootballMatch(cup.match) : cup.match,
        joined,
        status: finished ? "finished" : joined ? "joined" : "upcoming",
        rewardTableSlug: cup.rewardTableSlug,
        rewardTiers: REWARD_TABLES[cup.rewardTableSlug] ?? [],
        prediction: prediction ?? null,
      };
    },
    joinCup(cupId: string, userId: string) {
      const cd = db().competitionData;
      const cup = cd.cups.find((c) => c.id === cupId);
      if (!cup) throw new Error("جام یافت نشد");
      if (cd.cupEntries.some((e) => e.cupId === cupId && e.userId === userId)) {
        throw new Error("شما قبلاً ثبت‌نام کرده‌اید");
      }
      devMemoryDb.wallet.deductForPrediction(userId, cup.entryFeeCoins);
      cd.cupEntries.push({ id: `ce-${Date.now()}`, cupId, userId, status: "REGISTERED" });
      devMemoryDb.profile.incrementCups(userId);
      return { cupId, userId };
    },
    predictCup(cupId: string, userId: string, home: number, away: number) {
      const cd = db().competitionData;
      const cup = cd.cups.find((c) => c.id === cupId);
      if (!cup) throw new Error("جام یافت نشد");
      if (!cd.cupEntries.some((e) => e.cupId === cupId && e.userId === userId)) {
        throw new Error("ابتدا در جام ثبت‌نام کنید");
      }
      if (db().predictions.some((p) => p.userId === userId && p.competitionRefId === cupId)) {
        throw new Error("پیش‌بینی قبلاً ثبت شده");
      }
      const pred = devMemoryDb.predictions.create({
        userId,
        matchId: cup.matchId,
        competitionType: "CUP",
        competitionRefId: cupId,
        homePrediction: home,
        awayPrediction: away,
        entryFeeCoins: 0,
      });
      const entry = cd.cupEntries.find((e) => e.cupId === cupId && e.userId === userId);
      if (entry) entry.status = "PREDICTED";
      return pred;
    },
    listTournaments(userId: string, filter: string) {
      const cd = db().competitionData;
      return cd.tournaments
        .map((t) => {
          const joined = cd.tournamentEntries.some((e) => e.tournamentId === t.id && e.userId === userId);
          const finished = new Date() > new Date(t.endsAt);
          const status = finished ? "finished" : joined ? "joined" : "upcoming";
          return { ...t, joined, status };
        })
        .filter((t) => {
          if (filter === "joined") return t.joined && t.status !== "finished";
          if (filter === "finished") return t.status === "finished";
          return !t.joined && t.status !== "finished";
        });
    },
    getTournament(id: string, userId: string) {
      const cd = db().competitionData;
      const t = cd.tournaments.find((x) => x.id === id);
      if (!t) return null;
      const joined = cd.tournamentEntries.some((e) => e.tournamentId === id && e.userId === userId);
      const predictions = db().predictions.filter(
        (p) => p.userId === userId && p.competitionType === "TOURNAMENT" && p.competitionRefId === id,
      );
      return {
        ...t,
        joined,
        matches: t.matches.map((entry) => ({
          ...entry,
          match: entry.match ? localizeFootballMatch(entry.match) : entry.match,
        })),
        status: new Date() > new Date(t.endsAt) ? "finished" : joined ? "joined" : "upcoming",
        rewardTableSlug: t.rewardTableSlug,
        rewardTiers: REWARD_TABLES[t.rewardTableSlug] ?? [],
        predictions,
      };
    },
    registerTournament(tournamentId: string, userId: string) {
      const cd = db().competitionData;
      const t = cd.tournaments.find((x) => x.id === tournamentId);
      if (!t) throw new Error("تورنمنت یافت نشد");
      if (cd.tournamentEntries.some((e) => e.tournamentId === tournamentId && e.userId === userId)) {
        throw new Error("قبلاً ثبت‌نام کرده‌اید");
      }
      devMemoryDb.wallet.deductForPrediction(userId, t.registrationFeeCoins);
      cd.tournamentEntries.push({
        id: `te-${Date.now()}`,
        tournamentId,
        userId,
        status: "REGISTERED",
        totalPoints: 0,
      });
      devMemoryDb.profile.incrementTournaments(userId);
      return { tournamentId, userId };
    },
    predictTournament(tournamentId: string, userId: string, matchId: string, home: number, away: number) {
      const cd = db().competitionData;
      const t = cd.tournaments.find((x) => x.id === tournamentId);
      if (!t) throw new Error("تورنمنت یافت نشد");
      if (!cd.tournamentEntries.some((e) => e.tournamentId === tournamentId && e.userId === userId)) {
        throw new Error("ابتدا ثبت‌نام کنید");
      }
      if (db().predictions.some((p) => p.userId === userId && p.competitionRefId === tournamentId && p.matchId === matchId)) {
        throw new Error("پیش‌بینی این مسابقه ثبت شده");
      }
      devMemoryDb.wallet.deductForPrediction(userId, t.predictionFeeCoins);
      return devMemoryDb.predictions.create({
        userId,
        matchId,
        competitionType: "TOURNAMENT",
        competitionRefId: tournamentId,
        homePrediction: home,
        awayPrediction: away,
        entryFeeCoins: t.predictionFeeCoins,
      });
    },
    listTeamCompetitions(userId: string, filter: string) {
      const cd = db().competitionData;
      const userTeamIds = cd.teams
        .filter((t) => t.members.some((m) => m.userId === userId))
        .map((t) => t.id);
      return cd.teamCompetitions
        .map((c) => {
          const joined = cd.teamCompetitionEntries.some(
            (e) => e.teamCompetitionId === c.id && userTeamIds.includes(e.teamId),
          );
          const status =
            c.stage === "FINISHED"
              ? "finished"
              : c.stage === "REGISTRATION"
                ? "upcoming"
                : "active";
          return { ...c, joined, status };
        })
        .filter((c) => {
          if (filter === "joined" || filter === "active") {
            return c.stage === "RANKING" || c.stage === "KNOCKOUT";
          }
          if (filter === "finished") return c.stage === "FINISHED";
          return c.stage === "REGISTRATION";
        });
    },
    getTeamCompetition(id: string, userId: string) {
      const cd = db().competitionData;
      const comp = cd.teamCompetitions.find((c) => c.id === id);
      if (!comp) return null;
      const userTeam = cd.teams.find((t) => t.members.some((m) => m.userId === userId)) ?? null;
      return {
        ...comp,
        userTeam,
        status: comp.stage === "FINISHED" ? "finished" : userTeam ? "joined" : "upcoming",
      };
    },
    createTeam(userId: string, name: string) {
      const cd = db().competitionData;
      const team = {
        id: `team-${Date.now()}`,
        name,
        logoUrl: null,
        ownerId: userId,
        members: [{ userId, role: "OWNER" }],
      };
      cd.teams.push(team);
      return team;
    },
    getOwnerRegistrationBlock(userId: string, competitionId: string) {
      const cd = db().competitionData;
      const ownerTeamIds = cd.teams.filter((t) => t.ownerId === userId).map((t) => t.id);
      const entries = cd.teamCompetitionEntries.filter((e) => ownerTeamIds.includes(e.teamId));
      const inThis = entries.find((e) => e.teamCompetitionId === competitionId);
      return {
        registeredTeamIdInThisComp: inThis?.teamId ?? null,
        blockedByCompetition: null,
      };
    },
    findTeamsWithMemberCompetitionConflict(competitionId: string, teamIds: string[]) {
      const cd = db().competitionData;
      const blocked = new Set<string>();
      if (teamIds.length === 0) return blocked;

      const registeredUserToTeamId = new Map<string, string>();
      for (const entry of cd.teamCompetitionEntries) {
        if (entry.teamCompetitionId !== competitionId) continue;
        const registeredTeam = cd.teams.find((t) => t.id === entry.teamId);
        if (!registeredTeam) continue;
        for (const member of registeredTeam.members) {
          registeredUserToTeamId.set(member.userId, entry.teamId);
        }
      }

      for (const teamId of teamIds) {
        const team = cd.teams.find((t) => t.id === teamId);
        if (!team) continue;
        for (const member of team.members) {
          const otherTeamId = registeredUserToTeamId.get(member.userId);
          if (otherTeamId && otherTeamId !== teamId) {
            blocked.add(teamId);
            break;
          }
        }
      }

      return blocked;
    },
    joinTeamCompetition(competitionId: string, teamId: string, userId: string) {
      const cd = db().competitionData;
      const comp = cd.teamCompetitions.find((c) => c.id === competitionId);
      const team = cd.teams.find((t) => t.id === teamId);
      if (!comp || !team) throw new Error("رقابت یا تیم یافت نشد");
      if (team.ownerId !== userId) throw new Error("فقط مالک تیم می‌تواند ثبت‌نام کند");
      const ownerTeamIds = cd.teams.filter((t) => t.ownerId === userId).map((t) => t.id);
      const ownerEntries = cd.teamCompetitionEntries.filter((e) => ownerTeamIds.includes(e.teamId));
      const inThis = ownerEntries.find((e) => e.teamCompetitionId === competitionId);
      if (inThis && inThis.teamId !== teamId) {
        throw new Error("شما قبلاً یکی از تیم‌های خود را در این رقابت ثبت‌نام کرده‌اید");
      }
      const memberConflict = devMemoryDb.competitions.findTeamsWithMemberCompetitionConflict(
        competitionId,
        [teamId],
      );
      if (memberConflict.has(teamId)) {
        throw new Error(
          "یکی از اعضای این تیم قبلاً از طریق تیم دیگری در این رقابت ثبت‌نام کرده است",
        );
      }
      if (team.members.length < comp.minTeamSize) {
        throw new Error(`حداقل ${comp.minTeamSize} عضو لازم است`);
      }
      if (cd.teamCompetitionEntries.some((e) => e.teamCompetitionId === competitionId && e.teamId === teamId)) {
        throw new Error("تیم قبلاً ثبت‌نام کرده");
      }
      cd.teamCompetitionEntries.push({
        id: `tce-${Date.now()}`,
        teamCompetitionId: competitionId,
        teamId,
        rankingScore: 0,
      });
      devMemoryDb.profile.incrementTeamComps(userId);
      return { competitionId, teamId };
    },
  },
  medals: {
    listForUser(userId: string) {
      const cd = db().competitionData;
      return cd.userMedals
        .filter((m) => m.userId === userId)
        .map((um) => {
          const medal = cd.medals.find((m) => m.id === um.medalId);
          return {
            ...um,
            medal: medal
              ? {
                  id: medal.id,
                  slug: medal.slug,
                  titleFa: medal.titleFa,
                  tier: medal.tier,
                  category: medal.category,
                }
              : null,
          };
        });
    },
    award(userId: string, medalSlug: string, reason: string) {
      const cd = db().competitionData;
      const medal = cd.medals.find((m) => m.slug === medalSlug);
      if (!medal) return;
      const existing = cd.userMedals.find((m) => m.userId === userId && m.medalId === medal.id);
      if (existing) {
        existing.earnedReason = reason.trim() ? reason : "";
        return;
      }
      cd.userMedals.push({
        id: `um-${Date.now()}`,
        userId,
        medalId: medal.id,
        earnedReason: reason.trim() ? reason : "",
        earnedAt: new Date(),
      });
    },
  },
  missions: {
    listForUser(userId: string) {
      const cd = db().competitionData;
      return cd.missions.map((m) => {
        const progress = cd.missionProgress.find(
          (p) => p.userId === userId && p.missionId === m.id,
        );
        return {
          ...m,
          currentCount: progress?.currentCount ?? 0,
          completedAt: progress?.completedAt ?? null,
        };
      });
    },
    incrementProgress(userId: string, missionSlug: string) {
      const cd = db().competitionData;
      const mission = cd.missions.find((m) => m.slug === missionSlug);
      if (!mission) return;
      let progress = cd.missionProgress.find((p) => p.userId === userId && p.missionId === mission.id);
      if (!progress) {
        progress = { userId, missionId: mission.id, currentCount: 0, completedAt: null };
        cd.missionProgress.push(progress);
      }
      if (progress.completedAt) return;
      progress.currentCount += 1;
      if (progress.currentCount >= mission.targetCount) {
        progress.completedAt = new Date();
        devMemoryDb.medals.award(userId, mission.medalSlug, `تکمیل ${mission.titleFa}`);
      }
    },
  },
  missionClaims: {
    listForUser(userId: string) {
      return db()
        .competitionData.missionTierClaims.filter((row) => row.userId === userId)
        .map((row) => ({
          missionSlug: row.missionSlug,
          tierKey: row.tierKey,
          claimedAt: row.claimedAt,
        }));
    },
    hasClaim(userId: string, missionSlug: string, tierKey: string) {
      return db().competitionData.missionTierClaims.some(
        (row) =>
          row.userId === userId && row.missionSlug === missionSlug && row.tierKey === tierKey,
      );
    },
    record(userId: string, missionSlug: string, tierKey: string) {
      if (devMemoryDb.missionClaims.hasClaim(userId, missionSlug, tierKey)) return;
      db().competitionData.missionTierClaims.push({
        userId,
        missionSlug,
        tierKey,
        claimedAt: new Date(),
      });
    },
  },
  wheel: {
    getRewardOptions() {
      return db().competitionData.wheelRewards.map((option) => ({
        coins: option.coins,
        weight: option.weight,
      }));
    },
    spinCount(userId: string) {
      return db().competitionData.wheelSpins.filter(
        (spin) => spin.userId === userId && spin.coinsCostApplied >= 0,
      ).length;
    },
    canSpin(userId: string) {
      const cd = db().competitionData;
      const last = cd.wheelSpins
        .filter((s) => s.userId === userId)
        .sort((a, b) => b.spunAt.getTime() - a.spunAt.getTime())[0];
      if (!last) return true;
      return Date.now() - last.spunAt.getTime() >= 24 * 60 * 60 * 1000;
    },
    spin(userId: string) {
      return devMemoryDb.wheel.recordSpin(userId, devMemoryDb.wheel._pickReward(), 0);
    },
    recordSpin(userId: string, coinsWon: number, coinsCostApplied: number) {
      const cd = db().competitionData;
      if (!devMemoryDb.wheel.canSpin(userId)) {
        throw new Error("هنوز نمی‌توانید بچرخانید. هر ۲۴ ساعت یک بار.");
      }
      cd.wheelSpins.push({
        userId,
        spunAt: new Date(),
        coinsWon,
        coinsCostApplied,
      });
      return coinsWon;
    },
    _pickReward() {
      const cd = db().competitionData;
      const options = cd.wheelRewards;
      const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
      let roll = Math.random() * totalWeight;
      let selected = options[0];
      for (const option of options) {
        roll -= option.weight;
        if (roll <= 0) {
          selected = option;
          break;
        }
      }
      return selected.coins;
    },
    lastSpin(userId: string) {
      const cd = db().competitionData;
      return cd.wheelSpins
        .filter((s) => s.userId === userId && s.coinsCostApplied >= 0)
        .sort((a, b) => b.spunAt.getTime() - a.spunAt.getTime())[0] ?? null;
    },
    coinsWonPerDayLast3(userId: string, dayKeys: string[]) {
      const cd = db().competitionData;
      return dayKeys.map((dateKey) => {
        const { start, end } = tehranDayBounds(dateKey);
        return cd.wheelSpins
          .filter(
            (spin) =>
              spin.userId === userId &&
              spin.spunAt >= start &&
              spin.spunAt <= end,
          )
          .reduce((sum, spin) => sum + spin.coinsWon, 0);
      });
    },
  },
  store: {
    getPackages() {
      return db().competitionData.coinPackages;
    },
    buyPackage(userId: string, packageId: string, method: "wallet" | "gateway" = "gateway") {
      const pkg = db().competitionData.coinPackages.find((p) => p.id === packageId);
      if (!pkg) throw new Error("بسته یافت نشد");
      if (method === "wallet") {
        devMemoryDb.wallet.deductCash(userId, pkg.priceToman);
      }
      devMemoryDb.wallet.addPurchased(userId, pkg.coinAmount);
      db().competitionData.transactions.push({
        id: `tx-${Date.now()}`,
        userId,
        type: "PURCHASE",
        amount: pkg.coinAmount,
        description: `خرید ${pkg.nameFa}`,
        createdAt: new Date(),
      });
      return { pkg, paymentId: `pay-${Date.now()}` };
    },
  },
  cashWallet: {
    getPage(userId: string) {
      const wallet = db().wallets.get(userId);
      const profile = db().profiles.get(userId);
      if (!wallet || !profile) throw new Error("کیف پول یافت نشد");

      const shebaVerified = profile.shebaStatus === "VERIFIED";
      return {
        cashBalanceToman: wallet.cashBalanceToman,
        sheba: {
          digits: profile.shebaDigits,
          display: profile.shebaDigits ? `IR${profile.shebaDigits}` : null,
          status: profile.shebaStatus,
          submittedAt: profile.shebaSubmittedAt?.toISOString() ?? null,
          verifiedAt: profile.shebaVerifiedAt?.toISOString() ?? null,
          canSubmit:
            !profile.shebaDigits ||
            profile.shebaStatus === "NONE" ||
            profile.shebaStatus === "REJECTED",
          canWithdraw: shebaVerified,
        },
        conversions: db()
          .sellTransactions.filter((t) => t.userId === userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((t) => ({
            id: t.id,
            createdAt: t.createdAt.toISOString(),
            coinsSold: t.coinsSold,
            tomanValue: t.tomanValue,
          })),
        withdrawals: db()
          .withdrawals.filter((w) => w.userId === userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((w) => ({
            id: w.id,
            amountToman: w.amountToman,
            status: w.status,
            createdAt: w.createdAt.toISOString(),
          })),
      };
    },
    submitSheba(userId: string, digits: string) {
      const profile = db().profiles.get(userId);
      if (!profile) throw new Error("پروفایل یافت نشد");
      if (profile.shebaStatus === "PENDING_ADMIN" || profile.shebaStatus === "VERIFIED") {
        throw new Error("شماره شبای شما در حال بررسی یا تأیید شده است");
      }
      profile.shebaDigits = digits;
      profile.shebaStatus = "PENDING_ADMIN";
      profile.shebaSubmittedAt = new Date();
      profile.shebaVerifiedAt = null;
      profile.shebaInquiryMatched = null;
      db().profiles.set(userId, profile);
      return { shebaDigits: digits, status: "PENDING_ADMIN" as const };
    },
    async requestWithdrawal(userId: string, amount: number) {
      const profile = db().profiles.get(userId);
      const wallet = db().wallets.get(userId);
      const user = db().users.get(userId);
      if (!profile || !wallet || !user) throw new Error("کاربر یافت نشد");
      if (profile.shebaStatus !== "VERIFIED" || !profile.shebaDigits) {
        throw new Error("ابتدا شماره شبای خود را ثبت و تأیید کنید");
      }
      if (wallet.cashBalanceToman < amount) throw new Error("موجودی نقد کافی نیست");
      if (db().withdrawals.some((w) => w.userId === userId && w.status === "PENDING")) {
        throw new Error("یک درخواست در حال بررسی دارید");
      }
      const row: MemoryWithdrawal = {
        id: `wd-${Date.now()}`,
        userId,
        amountToman: amount,
        status: "PENDING",
        bankInfo: { shebaDigits: profile.shebaDigits },
        createdAt: new Date(),
      };
      db().withdrawals.push(row);
      const { sendTransactionalSms } = await import("@/server/services/sms-service");
      const { buildSmsIrTemplatePayload } = await import("@/server/config/sms-config");
      const {
        formatSmsAmount,
        smsAdminWithdrawalAlert,
        smsWithdrawalReceived,
        userFirstName,
      } = await import("@/shared/constants/sms-templates");
      const { ADMIN_NOTIFY_PHONE } = await import("@/shared/constants/wallet");
      const firstName = userFirstName(profile.displayName);
      await sendTransactionalSms(user.phone, smsWithdrawalReceived(firstName));
      await sendTransactionalSms(
        ADMIN_NOTIFY_PHONE,
        smsAdminWithdrawalAlert(profile.displayName, amount),
        buildSmsIrTemplatePayload("withdrawal_admin_alert", {
          name: profile.displayName?.trim() || user.phone,
          amount: formatSmsAmount(amount),
        }),
      );
      return row;
    },
    listPendingSheba() {
      return Array.from(db().profiles.values())
        .filter((p) => p.shebaStatus === "PENDING_ADMIN")
        .map((p) => {
          const user = db().users.get(p.userId);
          return {
            userId: p.userId,
            phone: user?.phone ?? "",
            displayName: p.displayName,
            shebaDigits: p.shebaDigits,
            shebaDisplay: p.shebaDigits ? `IR${p.shebaDigits}` : null,
            submittedAt: p.shebaSubmittedAt?.toISOString() ?? null,
            inquiryMatched: p.shebaInquiryMatched,
          };
        });
    },
    async inquireSheba(userId: string) {
      const profile = db().profiles.get(userId);
      const user = db().users.get(userId);
      if (!profile?.shebaDigits || !user) throw new Error("شماره شبا ثبت نشده");
      const { inquireShebaOwnership } = await import("@/server/services/sheba-inquiry-service");
      const result = await inquireShebaOwnership(profile.shebaDigits, user.phone);
      profile.shebaInquiryMatched = result.matched;
      db().profiles.set(userId, profile);
      return result;
    },
    async approveSheba(userId: string) {
      const profile = db().profiles.get(userId);
      const user = db().users.get(userId);
      if (!profile || profile.shebaStatus !== "PENDING_ADMIN") {
        throw new Error("درخواست شبای معتبری یافت نشد");
      }
      profile.shebaStatus = "VERIFIED";
      profile.shebaVerifiedAt = new Date();
      db().profiles.set(userId, profile);
      if (user) {
        const { sendTransactionalSms } = await import("@/server/services/sms-service");
        const { buildSmsIrTemplatePayload } = await import("@/server/config/sms-config");
        const { smsShebaVerified, userFirstName } = await import("@/shared/constants/sms-templates");
        const name = userFirstName(profile.displayName);
        await sendTransactionalSms(
          user.phone,
          smsShebaVerified(name),
          buildSmsIrTemplatePayload("sheba_verified", { name }),
        );
      }
      return { status: "VERIFIED" as const };
    },
    async requestShebaEdit(userId: string) {
      const profile = db().profiles.get(userId);
      const user = db().users.get(userId);
      if (!profile?.shebaDigits) throw new Error("شماره شبا ثبت نشده");
      profile.shebaStatus = "REJECTED";
      profile.shebaVerifiedAt = null;
      profile.shebaInquiryMatched = false;
      db().profiles.set(userId, profile);
      if (user) {
        const { sendTransactionalSms } = await import("@/server/services/sms-service");
        const { smsShebaRejected, userFirstName } = await import("@/shared/constants/sms-templates");
        await sendTransactionalSms(user.phone, smsShebaRejected(userFirstName(profile.displayName)));
      }
      return { status: "REJECTED" as const };
    },
    listWithdrawals() {
      return db()
        .withdrawals.filter((w) => w.status === "PENDING")
        .map((w) => {
          const user = db().users.get(w.userId);
          const profile = db().profiles.get(w.userId);
          return {
            id: w.id,
            userId: w.userId,
            displayName: profile?.displayName ?? user?.phone ?? "",
            phone: user?.phone ?? "",
            amountToman: w.amountToman,
            createdAt: w.createdAt.toISOString(),
            shebaDigits: w.bankInfo.shebaDigits,
          };
        });
    },
    async approveWithdrawal(withdrawalId: string) {
      const row = db().withdrawals.find((w) => w.id === withdrawalId);
      if (!row || row.status !== "PENDING") throw new Error("درخواست یافت نشد");
      const wallet = db().wallets.get(row.userId);
      if (!wallet || wallet.cashBalanceToman < row.amountToman) {
        throw new Error("موجودی کاربر کافی نیست");
      }
      wallet.cashBalanceToman -= row.amountToman;
      db().wallets.set(row.userId, wallet);
      row.status = "PAID";
      const user = db().users.get(row.userId);
      const profile = db().profiles.get(row.userId);
      if (user) {
        const { sendTransactionalSms } = await import("@/server/services/sms-service");
        const { buildSmsIrTemplatePayload } = await import("@/server/config/sms-config");
        const { formatSmsAmount, smsWithdrawalPaid, userFirstName } = await import("@/shared/constants/sms-templates");
        const { createNotification } = await import("@/server/services/notification-service");
        const { WITHDRAWAL_APPROVED_MESSAGE_FA } = await import("@/shared/constants/wallet");
        const firstName = userFirstName(profile?.displayName);
        await sendTransactionalSms(
          user.phone,
          smsWithdrawalPaid(firstName, row.amountToman),
          buildSmsIrTemplatePayload("withdrawal_approved", {
            name: firstName,
            amount: formatSmsAmount(row.amountToman),
          }),
        );
        await createNotification({
          userId: row.userId,
          type: "SYSTEM",
          category: "MESSAGE",
          titleFa: "دریافت وجه",
          bodyFa: WITHDRAWAL_APPROVED_MESSAGE_FA,
          link: "/profile/wallet",
        });
      }
      return { status: "PAID" as const };
    },
    async rejectWithdrawal(withdrawalId: string) {
      const row = db().withdrawals.find((w) => w.id === withdrawalId);
      if (!row || row.status !== "PENDING") throw new Error("درخواست یافت نشد");
      row.status = "REJECTED";
      const { createNotification } = await import("@/server/services/notification-service");
      const { WITHDRAWAL_REJECTED_MESSAGE_FA } = await import("@/shared/constants/wallet");
      await createNotification({
        userId: row.userId,
        type: "SYSTEM",
        category: "MESSAGE",
        titleFa: "دریافت وجه",
        bodyFa: WITHDRAWAL_REJECTED_MESSAGE_FA,
        link: "/profile/wallet",
      });
      return { status: "REJECTED" as const };
    },
  },
  invites: {
    countForUser(userId: string) {
      return db().competitionData.invites.filter((i) => i.inviterId === userId).length;
    },
    rewardedCountForUser(userId: string) {
      return db()
        .competitionData.invites.filter((i) => i.inviterId === userId && i.rewarded).length;
    },
    record(inviterId: string, inviteeId: string) {
      const cd = db().competitionData;
      if (cd.invites.some((i) => i.inviteeId === inviteeId)) return;
      const rewarded =
        isInviteUnlimitedRewardPromoActive() ||
        cd.invites.filter((i) => i.inviterId === inviterId && i.rewarded).length < 10;
      cd.invites.push({ inviterId, inviteeId, rewarded });
      devMemoryDb.wallet.addSystemReward(inviteeId, 50);
      devMemoryDb.profile.addXp(inviteeId, 100);
      if (rewarded) {
        devMemoryDb.wallet.addSystemReward(inviterId, 50);
        devMemoryDb.profile.addXp(inviterId, 100);
        devMemoryDb.notifications.create({
          userId: inviterId,
          type: "INVITE",
          category: "MESSAGE",
          titleFa: "دعوت موفق",
          bodyFa: "دوست شما به بردین پیوست! ۵۰ سکه و ۱۰۰ امتیاز گرفتی.",
          link: "/invite",
          secondaryLink: null,
          secondaryLinkLabelFa: null,
        });
      }
    },
  },
  leaderboard: {
    global() {
      const profiles = devMemoryDb.profile.getAll();
      const users = Array.from(db().users.values());
      return profiles
        .map((p) => {
          const user = users.find((u) => u.id === p.userId);
          if (
            !user ||
            isLegacyInvitePlaceholderUser({
              phone: user.phone,
              username: user.username,
              displayName: p.displayName,
            }) ||
            userNeedsDisplayName(user.phone, p.displayName)
          ) {
            return null;
          }
          const level = db().levels.find((l) => l.id === p.currentLevelId);
          const medalCount = db().competitionData.userMedals.filter((m) => m.userId === p.userId).length;
          return {
            userId: p.userId,
            username: user.username ?? "",
            displayName: p.displayName ?? user.username ?? "",
            avatarUrl: p.avatarUrl,
            showcaseSlug: p.showcaseSlug,
            totalXp: p.totalXp,
            level: level?.nameFa ?? "",
            medalCount,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
        .sort((a, b) => b.totalXp - a.totalXp)
        .map((row, i) => ({ ...row, rank: i + 1 }));
    },
    tournament(tournamentId: string) {
      const cd = db().competitionData;
      return cd.tournamentEntries
        .filter((e) => e.tournamentId === tournamentId)
        .map((e) => {
          const user = db().users.get(e.userId);
          const profile = db().profiles.get(e.userId);
          const level = db().levels.find((l) => l.id === profile?.currentLevelId);
          return {
            userId: e.userId,
            username: user?.username ?? "",
            displayName: profile?.displayName ?? "",
            totalPoints: e.totalPoints,
            level: level?.nameFa ?? "",
          };
        })
        .sort((a, b) => b.totalPoints - a.totalPoints)
        .map((row, i) => ({ ...row, rank: i + 1 }));
    },
  },
};
