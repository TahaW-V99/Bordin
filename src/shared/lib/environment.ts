/**
 * Runtime environment label for Bordin.
 * Set BORDIN_ENV=staging on the staging Liara app; production uses production or unset.
 */
export type BordinEnvironment = "development" | "staging" | "production";

export function getBordinEnvironment(): BordinEnvironment {
  const label = process.env.BORDIN_ENV?.toLowerCase();
  if (label === "staging") return "staging";
  if (label === "production") return "production";
  if (process.env.NODE_ENV === "production") return "production";
  return "development";
}

export function isStagingEnvironment(): boolean {
  return getBordinEnvironment() === "staging";
}

export function isProductionEnvironment(): boolean {
  return getBordinEnvironment() === "production";
}

const BORDIN_IR_HOSTS = new Set(["bordin.ir", "www.bordin.ir"]);
const BORDINTEST_HOSTS = new Set(["bordintest.ir", "www.bordintest.ir"]);

/** Hostnames allowed for payment callbacks and post-checkout redirects. */
const ALLOWED_PUBLIC_APP_HOSTS = new Set([
  ...BORDIN_IR_HOSTS,
  ...BORDINTEST_HOSTS,
]);

export function normalizeHostname(host: string): string {
  return host.toLowerCase().split(":")[0].trim();
}

export function isBordinIrHost(hostname: string): boolean {
  if (!hostname.trim()) return false;
  return BORDIN_IR_HOSTS.has(normalizeHostname(hostname));
}

export function isBordinTestHost(hostname: string): boolean {
  if (!hostname.trim()) return false;
  return BORDINTEST_HOSTS.has(normalizeHostname(hostname));
}

function isLocalHostname(hostname: string): boolean {
  const h = normalizeHostname(hostname);
  return h === "localhost" || h === "127.0.0.1" || h === "::1" || h.endsWith(".localhost");
}

export function isAllowedPublicAppHost(hostname: string): boolean {
  const h = normalizeHostname(hostname);
  if (ALLOWED_PUBLIC_APP_HOSTS.has(h)) return true;
  if (h.endsWith(".liara.run")) return true;
  if (h.endsWith(".workers.dev")) return true;
  if (getBordinEnvironment() === "development" && isLocalHostname(h)) return true;
  return false;
}

function originFromRequestHeaders(request?: Pick<Request, "headers">): string | null {
  if (!request) return null;
  const rawHost = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const host = rawHost?.split(",")[0]?.trim();
  if (!host) return null;
  const hostname = host.includes(":") ? host.slice(0, host.lastIndexOf(":")) : host;
  if (!isAllowedPublicAppHost(hostname)) return null;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
  return `${proto}://${host}`;
}

function sanitizeAllowedOrigin(value?: string | null): string | null {
  if (!value?.trim()) return null;
  return originFromUrl(value.trim());
}

function originFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url.includes("://") ? url : `https://${url}`);
    if (!isAllowedPublicAppHost(parsed.hostname)) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

/**
 * Canonical return origin for store / Zibal payment flows.
 * Never uses localhost on production or staging — prefers the live browser origin.
 */
export function resolveStoreReturnOrigin(
  request?: Pick<Request, "headers">,
  clientOrigin?: string | null,
): string {
  const fromClient = sanitizeAllowedOrigin(clientOrigin);
  if (fromClient) return fromClient;

  const fromRequest = originFromRequestHeaders(request);
  if (fromRequest) return fromRequest;

  const fromEnv = sanitizeAllowedOrigin(process.env.NEXT_PUBLIC_APP_URL?.trim());
  if (fromEnv) return fromEnv;

  if (isStagingEnvironment()) return "https://bordintest.ir";
  if (isProductionEnvironment()) return "https://bordin.ir";
  return "http://localhost:3000";
}

/**
 * Public app origin for share links, callbacks, etc.
 * Prefers the live request host (bordin.ir / bordintest.ir), not localhost env overrides.
 */
export function resolvePublicAppOrigin(request?: Pick<Request, "headers">): string {
  return resolveStoreReturnOrigin(request);
}

const DEFAULT_PRODUCTION_SOCIAL_MIRROR = "https://bordin.ir";
const DEFAULT_STAGING_SOCIAL_MIRROR = "https://bordintest.ir";

function sanitizeSocialMirrorOrigin(value?: string | null): string | null {
  if (!value?.trim()) return null;
  const origin = originFromUrl(value.trim());
  if (!origin) return null;
  // Legacy workers.dev mirrors are retired; never use them as share targets.
  if (origin.includes(".workers.dev")) return null;
  return origin;
}

/**
 * Origin for Telegram/Instagram share links and in-app browser entry.
 * Defaults to the live app domain (bordin.ir / bordintest.ir).
 */
export function resolveSocialShareOrigin(request?: Pick<Request, "headers">): string {
  const fromEnv =
    sanitizeSocialMirrorOrigin(process.env.BORDIN_SOCIAL_MIRROR_URL) ??
    sanitizeSocialMirrorOrigin(process.env.NEXT_PUBLIC_BORDIN_SOCIAL_MIRROR_URL);
  if (fromEnv) return fromEnv;

  if (isStagingEnvironment()) {
    return DEFAULT_STAGING_SOCIAL_MIRROR;
  }

  if (isProductionEnvironment()) {
    return DEFAULT_PRODUCTION_SOCIAL_MIRROR;
  }

  return resolvePublicAppOrigin(request);
}

/**
 * Store "sell coins" tab — hidden unless STORE_SELL_ENABLED=true in env.
 */
export function isStoreSellTabVisibleForHost(_hostname?: string): boolean {
  const env = process.env.STORE_SELL_ENABLED?.trim().toLowerCase();
  return env === "true" || env === "1";
}
