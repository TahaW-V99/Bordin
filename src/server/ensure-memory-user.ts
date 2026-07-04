import { getSession } from "@/shared/lib/auth";
import { shouldUseMemoryDb } from "@/server/db";
import { devMemoryDb, type MemoryUser } from "@/server/dev-memory-db";

/** Ensures the session user exists in the in-memory store (e.g. after dev server restart). */
export async function ensureMemoryUser(userId: string): Promise<MemoryUser | null> {
  if (!(await shouldUseMemoryDb())) return null;

  const existing = devMemoryDb.user.findById(userId);
  if (existing) return existing;

  const session = await getSession();
  if (session?.userId === userId && session.phone) {
    return devMemoryDb.user.ensureFromSession(userId, session.phone);
  }

  return null;
}