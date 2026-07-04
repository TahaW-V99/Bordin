import type { User } from "@prisma/client";
import { prisma } from "@/shared/lib/prisma";
import { createSession, type SessionPayload } from "@/shared/lib/auth";
import { shouldUseMemoryDb } from "@/server/db";
import { ensureMemoryUser } from "@/server/ensure-memory-user";

type ResolvedDbUser = {
  user: User;
  sessionRefresh: boolean;
};

/** Resolve a DB user from session ids; falls back to phone when JWT userId is stale. */
export async function resolveDbUser(
  userId: string,
  phone?: string,
): Promise<ResolvedDbUser | null> {
  if (await shouldUseMemoryDb()) {
    const mem = await ensureMemoryUser(userId);
    if (!mem) return null;
    return {
      user: mem as unknown as User,
      sessionRefresh: false,
    };
  }

  const byId = await prisma.user.findUnique({ where: { id: userId } });
  if (byId) return { user: byId, sessionRefresh: false };

  if (phone) {
    const byPhone = await prisma.user.findUnique({ where: { phone } });
    if (byPhone) {
      return { user: byPhone, sessionRefresh: byPhone.id !== userId };
    }
  }

  return null;
}

/** Read-only lookup; safe to call from Server Components (no cookie writes). */
export async function lookupSessionUser(session: SessionPayload): Promise<User | null> {
  const resolved = await resolveDbUser(session.userId, session.phone);
  return resolved?.user ?? null;
}

/** Refreshes cookie when userId was stale. Use only in Route Handlers / Server Actions. */
export async function reconcileSessionUser(session: SessionPayload): Promise<User | null> {
  const resolved = await resolveDbUser(session.userId, session.phone);
  if (!resolved) return null;

  if (resolved.sessionRefresh) {
    await createSession({ userId: resolved.user.id, phone: session.phone });
  }

  return resolved.user;
}
