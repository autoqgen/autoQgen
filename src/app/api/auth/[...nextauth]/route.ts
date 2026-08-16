import NextAuth from "next-auth";
import type { NextRequest } from "next/server";

import { authOptions } from "@/lib/auth/options";

const handler = NextAuth(authOptions);

async function authHandler(
  req: NextRequest,
  context: { params: Promise<{ nextauth?: string[] }> | { nextauth?: string[] } },
) {
  const params = await context.params;
  return handler(req, { params });
}

export { authHandler as GET, authHandler as POST };


