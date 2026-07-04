/**
 * Verifies staging auth + onboarding against live server.
 * Usage: BASE_URL=https://bordintest.liara.run npx tsx scripts/verify-staging-auth-http.ts
 */
import { config } from "dotenv";
import { SignJWT } from "jose";

config({ path: ".env.staging.local" });
config({ path: ".env.staging" });
config({ path: ".env.local" });
config({ path: ".env" });

const BASE = process.env.BASE_URL ?? "https://bordintest.liara.run";
const PHONE = process.env.STAGING_TEST_PHONE ?? "09125556677";
const OTP = process.env.SMS_MOCK_MODE === "true" ? "123456" : process.env.STAGING_TEST_OTP;
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "bordin-dev-secret-change-in-production-32chars",
);

function parseCookies(setCookie: string | null, existing = ""): string {
  const jar = new Map<string, string>();
  for (const part of existing.split(";").map((s) => s.trim()).filter(Boolean)) {
    const [k, ...v] = part.split("=");
    if (k) jar.set(k, v.join("="));
  }
  if (setCookie) {
    for (const chunk of setCookie.split(/,(?=\s*\w+=)/)) {
      const first = chunk.split(";")[0].trim();
      const [k, ...v] = first.split("=");
      if (k) jar.set(k, v.join("="));
    }
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function api(
  path: string,
  options: RequestInit & { cookie?: string } = {},
): Promise<{ status: number; json: unknown; cookie: string; text: string }> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.headers ?? {}),
    },
  });
  const setCookie = res.headers.get("set-cookie");
  const cookie = parseCookies(setCookie, options.cookie);
  const text = await res.text();
  let json: unknown = {};
  try {
    json = JSON.parse(text);
  } catch {
    // HTML redirect responses are OK for layout checks
  }
  return { status: res.status, json, cookie, text };
}

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error("FAIL:", message);
    process.exit(1);
  }
  console.log("OK:", message);
}

async function staleSessionCookie(phone: string): Promise<string> {
  const token = await new SignJWT({ userId: "stale-deleted-user-id", phone })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(JWT_SECRET);
  return `bordin_session=${token}`;
}

async function main() {
  console.log(`Testing ${BASE} with phone ${PHONE}`);

  // Scenario A: stale JWT after DB reset should NOT prisma-crash onboarding
  const staleCookie = await staleSessionCookie(PHONE);
  const staleOnboarding = await api("/api/auth/onboarding-complete", {
    method: "POST",
    cookie: staleCookie,
  });
  assert(
    staleOnboarding.status === 401,
    `stale session onboarding returns 401 (got ${staleOnboarding.status})`,
  );
  const staleError = (staleOnboarding.json as { error?: string }).error ?? "";
  assert(
    !staleError.includes("prisma.user.update"),
    "stale session error is user-friendly, not raw Prisma",
  );

  // Scenario B: fresh login + onboarding
  if (!OTP) {
    console.log("SKIP: fresh login (set SMS_MOCK_MODE=true or STAGING_TEST_OTP)");
    return;
  }

  let cookie = "";
  const send = await api("/api/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE }),
  });
  assert(send.status === 200, `send-otp (${send.status})`);

  const verify = await api("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ phone: PHONE, code: OTP }),
    cookie: send.cookie,
  });
  assert(verify.status === 200, `verify-otp (${verify.status})`);
  cookie = verify.cookie;
  assert(cookie.includes("bordin_session"), "session cookie set after login");

  const onboarding = await api("/api/auth/onboarding-complete", {
    method: "POST",
    cookie,
  });
  assert(onboarding.status === 200, `onboarding-complete (${onboarding.status})`);

  const me = await api("/api/user/me", { cookie: onboarding.cookie || cookie });
  assert(me.status === 200, `user/me after onboarding (${me.status})`);

  console.log("\nAll staging auth checks passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
