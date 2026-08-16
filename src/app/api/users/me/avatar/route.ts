import { NextResponse } from "next/server";
import { getOptionalUser } from "@/lib/auth/session";
import { connectDB } from "@/lib/db";
import { User } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const actor = await getOptionalUser();
    if (!actor) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    await connectDB();
    const user = await User.findById(actor.objectId).select("image").lean().exec();

    if (!user?.image) {
      return new NextResponse("Avatar not found", { status: 404 });
    }

    if (user.image.startsWith("data:")) {
      const matches = user.image.match(/^data:([^;]+);base64,(.*)$/);
      if (matches && matches[1] && matches[2]) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");

        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "private, max-age=3600, stale-while-revalidate=600",
          },
        });
      }
    }

    if (user.image.startsWith("http://") || user.image.startsWith("https://")) {
      return NextResponse.redirect(user.image);
    }

    return new NextResponse("Invalid avatar format", { status: 404 });
  } catch {
    return new NextResponse("Internal server error", { status: 500 });
  }
}
