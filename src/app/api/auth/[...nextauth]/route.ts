import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth/options";

/**
 * The single Auth.js entry point.
 *
 * `authOptions` deliberately lives in `@/lib/auth/options` so it can also be
 * passed to `getServerSession` from services, server components and the route
 * factory. No `as any` cast: the session and JWT shapes are declared in
 * `src/types/next-auth.d.ts`.
 */
const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
