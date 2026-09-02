import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js Edge Middleware.
 *
 * Runs on the Edge Runtime before request routing. Handles session presence
 * gating for /dashboard and /admin routes, and redirects authenticated users
 * away from authentication pages (/login, /register, /forgot, /reset).
 *
 * Direct env access (process.env.NEXTAUTH_SECRET) is used as recommended for
 * Edge Middleware to prevent pulling Node-only config modules into Edge.
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // "Authenticated" for routing means the JWT actually names a user (`uid`), the
  // same thing `getOptionalUser()` requires server-side. A cookie that decodes
  // but carries no `uid` (a pre-`uid` token, a stale secret, or a failed reload
  // in the `jwt` callback) identifies nobody, so it must be treated as anonymous
  // here. Accepting bare `Boolean(token)` let middleware wave such a request
  // through to a server component whose `getOptionalUser()` then rejected it and
  // redirected to `/login`, which this file bounced straight back to
  // `/dashboard` — an endless `/dashboard` redirect loop.
  const hasIdentity = Boolean(token?.uid);
  const isActiveSession = hasIdentity && token?.status === "active";

  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot") ||
    pathname.startsWith("/reset");

  const isProtectedPage =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (isProtectedPage && !hasIdentity) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && isActiveSession) {
    // Do not bounce a caller who was deliberately sent here to re-authenticate
    // by a server-side gate — its `callbackUrl` points back at a protected
    // route. Such a token can be structurally valid yet unusable (user deleted,
    // suspended in the DB after the token was minted, or the database reseeded
    // in development), and bouncing it back to `/dashboard` is the other half
    // of the loop. Let `/login` render so the caller can sign in afresh.
    const callbackUrl = req.nextUrl.searchParams.get("callbackUrl") ?? "";
    const sentHereToReauth =
      callbackUrl.startsWith("/dashboard") || callbackUrl.startsWith("/admin");

    if (!sentHereToReauth) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - /api/* (API route authentication & transport concerns are handled by defineRoute)
     * - /_next/* (static files and Next.js internal assets)
     * - /favicon.ico, /icon.svg (site static icons)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
