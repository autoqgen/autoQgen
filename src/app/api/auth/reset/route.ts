import { NextResponse } from "next/server";
import { consumeToken } from "../../../../lib/tokenStore";
import { setPassword } from "../../../../lib/userStore";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = body?.email;
    const token = body?.token;
    const password = body?.password;
    if (!email || !token || !password) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
    }

    const ok = consumeToken(email, token);
    if (!ok) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
    }

    const hash = await bcrypt.hash(password, 10);
    setPassword(email, hash);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
