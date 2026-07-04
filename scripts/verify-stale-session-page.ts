/**
 * Verifies stale JWT does not crash page render (should redirect, not 500).
 * Usage: BASE_URL=https://bordintest.liara.run npx tsx scripts/verify-stale-session-page.ts
 */
import { config } from "dotenv";
import { SignJWT } from "jose";

config({ path: ".env.staging.local" });
config({ path: ".env.staging" });

const BASE = process.env.BASE_URL ?? "https://bordintest.liara.run";
const PHONE = "09125556677";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "bordin-staging-jwt-secret-not-for-production-32c",
);

async function staleCookie(): Promise<string> {
  const token = await new SignJWT({ userId: "stale-deleted-user-id", phone: PHONE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
  return `bordin_session=${token}`;
}

async function main() {
  const cookie = await staleCookie();

  for (const path of ["/", "/home", "/onboarding"]) {
    const res = await fetch(`${BASE}${path}`, {
      redirect: "manual",
      headers: { Cookie: cookie },
    });
    const text = await res.text();
    const isAppError = text.includes("Application error") || text.includes("server-side exception");
    console.log(`${path}: status=${res.status} location=${res.headers.get("location") ?? "-"} appError=${isAppError}`);
    if (isAppError || res.status === 500) {
      console.error("FAIL: page crashed for stale session at", path);
      process.exit(1);
    }
  }

  const logout = await fetch(`${BASE}/api/auth/logout?redirect=/login`, {
    redirect: "manual",
    headers: { Cookie: cookie },
  });
  console.log(`logout: status=${logout.status} location=${logout.headers.get("location") ?? "-"}`);
  if (logout.status !== 307 && logout.status !== 302 && logout.status !== 308) {
    console.error("FAIL: logout redirect expected");
    process.exit(1);
  }

  console.log("OK: stale session pages redirect instead of crashing");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
