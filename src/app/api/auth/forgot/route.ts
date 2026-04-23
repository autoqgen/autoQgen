import { NextResponse } from "next/server";
import { createTokenForEmail } from "../../../../lib/tokenStore";
import { sendResetEmail } from "../../../../lib/sendgrid";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body?.email;
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const token = createTokenForEmail(email);
    const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3001";
    const resetUrl = `${baseUrl.replace(/\/$/, "")}/auth/reset?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    try {
      await sendResetEmail(email, resetUrl);
    } catch (err) {
      console.error("Error sending reset email:", err);
      return NextResponse.json({ error: "Failed to send reset email" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "If an account exists, reset instructions will be sent." });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
