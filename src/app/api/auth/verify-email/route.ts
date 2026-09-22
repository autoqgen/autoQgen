import { NextResponse } from "next/server";

import { emailVerificationService } from "@/lib/services/email-verification.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const verified = token.length === 64 && (await emailVerificationService.verify(token));
  const target = new URL("/login", request.url);
  target.searchParams.set("verified", verified ? "1" : "0");
  return NextResponse.redirect(target);
}