import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Edge middleware.
 *
 * First line of defence only. Every API handler re-checks authentication and
 * authorization server-side through `defineRoute`, because middleware can be
 * bypassed by routing changes and cannot express per-resource ownership rules.
 * The previous project had no middleware at all and gated the dashboard purely
 * with a client-side `useSession()` check, which protected nothing.
 *
 * Runs on the edge runtime: no Mongoose, no Node built-ins.
 */

const PUBLIC_API_PREFIXES = ["/api/auth", "/api/health"];

const PUBLIC_PAGES = new Set(["/", "/login", "/register", "/forgot", "/reset"]);

function isPublicApi(pathname: string): boolean {
  return PUBLIC_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  const isAuthenticated = Boolean(token?.uid);

  /* ---------------------------------- API ---------------------------------- */
  if (pathname.startsWith("/api")) {
    if (isPublicApi(pathname)) {
      return NextResponse.next();
    }

    if (!isAuthenticated) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Authentication is required." },
          requestId: crypto.randomUUID(),
        },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.next();
  }

  /* --------------------------------- Pages --------------------------------- */
  if (pathname.startsWith("/dashboard")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Signed-in users have no reason to sit on the auth screens.
  if (isAuthenticated && PUBLIC_PAGES.has(pathname) && pathname !== "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except Next internals and static assets.
     * Keeping public marketing routes inside the matcher is deliberate: the
     * signed-in redirect above needs to see them.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?)$).*)",
  ],
};
