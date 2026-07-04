import { prisma } from "@/shared/lib/prisma";
import { isDevMemoryDbEnabled } from "./dev-memory-db";

let prismaReachable: boolean | null = null;

export async function shouldUseMemoryDb(): Promise<boolean> {
  // Never fall back to in-memory data on production — prevents empty/broken live site.
  if (process.env.NODE_ENV === "production") return false;
  if (!isDevMemoryDbEnabled()) return false;
  // Explicit local dev mode — skip MySQL probe for consistent in-memory behavior.
  if (process.env.DEV_MEMORY_DB === "true") return true;
  if (prismaReachable === true) return false;
  if (prismaReachable === false) return true;

  try {
    await prisma.$queryRaw`SELECT 1`;
    prismaReachable = true;
    return false;
  } catch {
    prismaReachable = false;
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[Bordin] MySQL unavailable — using in-memory dev database. Run npm run db:setup when MySQL is ready.",
      );
    }
    return true;
  }
}

export function resetDbProbe() {
  prismaReachable = null;
}
