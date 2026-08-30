import { describe, expect, it } from "vitest";
import { authOptions } from "@/lib/auth/options";

describe("authOptions configuration", () => {
  it("defines jwt and session callbacks", () => {
    expect(authOptions.callbacks).toBeDefined();
    expect(authOptions.callbacks?.jwt).toBeDefined();
    expect(authOptions.callbacks?.session).toBeDefined();
  });

  it("converts base64 images to avatar endpoint URLs to keep JWT compact", async () => {
    const jwtCallback = authOptions.callbacks?.jwt;
    if (!jwtCallback) throw new Error("jwt callback missing");

    const hugeBase64Image = "data:image/jpeg;base64," + "A".repeat(10000);
    const token = await jwtCallback({
      token: {
        uid: "123",
        email: "test@example.com",
        role: "teacher",
        status: "active",
        tokenVersion: 0,
        organizationId: null,
      },
      user: { id: "123", role: "teacher", status: "active", email: "test@example.com", image: hugeBase64Image },
      account: null,
      profile: undefined,
      isNewUser: false,
      trigger: "signUp",
    });

    expect(token.picture).toBe("/api/users/123/avatar");
  });
});
