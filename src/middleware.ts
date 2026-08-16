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

  const isAuthenticated = Boolean(token);
  const isAuthPage =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot") ||
    pathname.startsWith("/reset");

  const isProtectedPage =
    pathname.startsWith("/dashboard") || pathname.startsWith("/admin");

  if (isProtectedPage && !isAuthenticated) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
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
