/**
 * Cloudflare edge proxy for bordin.ir / bordintest.ir.
 * Fetches the Liara app origin so the site stays reachable when direct .ir access fails (e.g. VPN).
 */

type Env = {
  ORIGIN?: string;
  STAGING_ORIGIN?: string;
};

const DEFAULT_PRODUCTION_ORIGIN = "https://bordin.liara.run";
const DEFAULT_STAGING_ORIGIN = "https://bordintest.liara.run";

const LOCATION_HOSTS = [
  "bordin.ir",
  "www.bordin.ir",
  "bordintest.ir",
  "www.bordintest.ir",
  "bordin.liara.run",
  "bordintest.liara.run",
];

function isStagingHost(hostname: string): boolean {
  return hostname.toLowerCase().includes("bordintest");
}

function resolveOrigin(incomingHost: string, env: Env): string {
  if (isStagingHost(incomingHost)) {
    return (env.STAGING_ORIGIN ?? DEFAULT_STAGING_ORIGIN).replace(/\/$/, "");
  }
  return (env.ORIGIN ?? DEFAULT_PRODUCTION_ORIGIN).replace(/\/$/, "");
}

function rewriteLocation(location: string, publicOrigin: string, origin: string): string {
  let rewritten = location;
  const hosts = [new URL(origin).host, ...LOCATION_HOSTS];
  for (const host of hosts) {
    const escaped = host.replace(/\./g, "\\.");
    rewritten = rewritten.replace(
      new RegExp(`^https?:\\/\\/(?:www\\.)?${escaped}(?=\\/|$)`, "i"),
      publicOrigin,
    );
  }
  return rewritten;
}

function rewriteSetCookie(cookie: string): string {
  return cookie.replace(/;\s*Domain=[^;]*/gi, "");
}

function appendRewrittenCookies(from: Headers, to: Headers) {
  if (typeof from.getSetCookie === "function") {
    for (const cookie of from.getSetCookie()) {
      to.append("Set-Cookie", rewriteSetCookie(cookie));
    }
    return;
  }

  const raw = from.get("Set-Cookie");
  if (raw) to.append("Set-Cookie", rewriteSetCookie(raw));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const incoming = new URL(request.url);
    const origin = resolveOrigin(incoming.hostname, env);
    const publicOrigin = incoming.origin;
    const target = new URL(incoming.pathname + incoming.search, `${origin}/`);

    const headers = new Headers(request.headers);
    headers.set("Host", new URL(origin).host);
    headers.set("X-Forwarded-Host", incoming.host);
    headers.set("X-Forwarded-Proto", incoming.protocol.replace(":", ""));

    const cf = (request as Request & { cf?: { country?: string } }).cf;
    if (cf?.country) {
      headers.set("CF-IPCountry", cf.country);
    }

    const clientIp = request.headers.get("CF-Connecting-IP");
    if (clientIp) {
      headers.set("X-Forwarded-For", clientIp);
    }

    const init: RequestInit = {
      method: request.method,
      headers,
      redirect: "manual",
    };

    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = request.body;
    }

    const response = await fetch(target.toString(), init);
    const outHeaders = new Headers(response.headers);

    const location = outHeaders.get("Location");
    if (location) {
      outHeaders.set("Location", rewriteLocation(location, publicOrigin, origin));
    }

    outHeaders.delete("Set-Cookie");
    appendRewrittenCookies(response.headers, outHeaders);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  },
};
