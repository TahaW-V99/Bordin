/**
 * Public mirror for bordin.ir on Cloudflare edge.
 * Used when bordin.ir is blocked in Telegram/Instagram in-app browsers on mobile networks.
 */

type Env = {
  ORIGIN?: string;
};

const DEFAULT_ORIGIN = "https://bordin.ir";

function rewriteLocation(location: string, publicOrigin: string): string {
  return location.replace(/^https?:\/\/(?:www\.)?bordin\.ir(?=\/|$)/i, publicOrigin);
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
    const origin = (env.ORIGIN ?? DEFAULT_ORIGIN).replace(/\/$/, "");
    const incoming = new URL(request.url);
    const publicOrigin = incoming.origin;
    const target = new URL(incoming.pathname + incoming.search, `${origin}/`);

    const headers = new Headers(request.headers);
    headers.set("Host", new URL(origin).host);
    headers.set("X-Forwarded-Host", new URL(origin).host);
    headers.set("X-Forwarded-Proto", "https");

    const init: RequestInit & { cf?: { cacheTtl?: number } } = {
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
      outHeaders.set("Location", rewriteLocation(location, publicOrigin));
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
