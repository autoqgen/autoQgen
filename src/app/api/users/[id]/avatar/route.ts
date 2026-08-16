import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return new NextResponse("Missing user ID", { status: 400 });
    }

    await connectDB();
    const user = await User.findById(id).select("image").lean().exec();

    if (!user?.image) {
      return new NextResponse("Avatar not found", { status: 404 });
    }

    // Handle base64 data URLs (e.g. data:image/jpeg;base64,...)
    if (user.image.startsWith("data:")) {
      const matches = user.image.match(/^data:([^;]+);base64,(.*)$/);
      if (matches && matches[1] && matches[2]) {
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");

        return new NextResponse(new Uint8Array(buffer), {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=86400, stale-while-revalidate=3600",
          },
        });
      }
    }

    // Handle standard HTTP/HTTPS URLs
    if (user.image.startsWith("http://") || user.image.startsWith("https://")) {
      return NextResponse.redirect(user.image);
    }

    return new NextResponse("Invalid avatar format", { status: 404 });
  } catch {
    return new NextResponse("Internal server error", { status: 500 });
  }
}
