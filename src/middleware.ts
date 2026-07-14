import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = [
  "/",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/faq",
  "/login",
  "/api/auth/send-otp",
  "/api/auth/resend-otp",
  "/api/auth/verify-otp",
  "/api/auth/invalidate-otp",
  "/api/auth/check-phone",
  "/api/auth/login-password",
  "/api/auth/logout",
  "/api/public/contact",
  "/showcase",
];

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? "bordin-dev-secret-change-in-production-32chars",
);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => {
    if (p === "/") return pathname === "/";
    return pathname === p || pathname.startsWith(`${p}/`);
  });
}

function redirectToCanonicalHost(request: NextRequest): NextResponse | null {
  const host = request.headers.get("host");
  if (!host?.toLowerCase().startsWith("www.")) return null;

  const url = request.nextUrl.clone();
  url.host = host.slice(4);
  return NextResponse.redirect(url, 301);
}

export async function middleware(request: NextRequest) {
  const canonicalRedirect = redirectToCanonicalHost(request);
  if (canonicalRedirect) return canonicalRedirect;

  const { pathname } = request.nextUrl;
  const token = request.cookies.get("bordin_session")?.value;

  if (pathname === "/" && token) {
    try {
      await jwtVerify(token, JWT_SECRET);
      return NextResponse.redirect(new URL("/home", request.url));
    } catch {
      // Invalid session cookie — show the public landing page.
    }
  }

  const isPublicProfileApi =
    pathname.startsWith("/api/profile/") && pathname !== "/api/profile";

  const isPublicTeamApi = pathname.startsWith("/api/public/teams/");

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/internal/") ||
    pathname.startsWith("/api/team-competition-banners/") ||
    pathname.includes(".") ||
    isPublicProfileApi ||
    isPublicTeamApi ||
    isPublicPath(pathname)
  ) {
    return NextResponse.next();
  }

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons|logo|avatars).*)"],
};
