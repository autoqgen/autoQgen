import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { clearCollections, startDatabase } from "./db";

/**
 * The previous project's worst defect: `reset` wrote the new hash into
 * `data/users.json` while login read MongoDB, so a "successful" reset silently
 * did nothing. These tests assert the password actually changes in the database
 * and that a token cannot be replayed.
 */

let available = false;
let stop: (() => Promise<void>) | null = null;

beforeAll(async () => {
  const harness = await startDatabase();
  available = harness !== null;
  stop = harness?.stop ?? null;
});

afterAll(async () => {
  await stop?.();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

describe.skipIf(!available)("password reset", () => {
  async function setup() {
    const { User } = await import("@/models");
    const { hashPassword, verifyPassword } = await import("@/lib/auth/password");
    const { passwordResetService } = await import("@/lib/services/password-reset.service");
    const { passwordResetRepository } = await import("@/lib/repositories/password-reset.repo");

    const user = await User.create({
      name: "Reset Target",
      email: "reset@example.com",
      password: await hashPassword("original passphrase here"),
      role: "teacher",
      status: "active",
    });

    return { User, user, verifyPassword, passwordResetService, passwordResetRepository };
  }

  it("updates the password in MongoDB and lets the new one verify", async () => {
    const { User, user, verifyPassword, passwordResetService } = await setup();
    const { sha256, randomToken } = await import("@/lib/security/hash");
    const { passwordResetRepository } = await import("@/lib/repositories/password-reset.repo");

    const token = randomToken(32);
    await passwordResetRepository.create({
      userId: user._id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await passwordResetService.resetPassword({
      token,
      password: "brand new passphrase",
      confirmPassword: "brand new passphrase",
    });

    const updated = await User.findById(user._id).select("+password tokenVersion").lean().exec();

    expect(updated?.password).toBeDefined();
    expect(await verifyPassword("brand new passphrase", updated!.password!)).toBe(true);
    expect(await verifyPassword("original passphrase here", updated!.password!)).toBe(false);
    // Existing sessions are revoked.
    expect(updated?.tokenVersion).toBe(1);
  });

  it("rejects a reused token", async () => {
    const { user, passwordResetService } = await setup();
    const { sha256, randomToken } = await import("@/lib/security/hash");
    const { passwordResetRepository } = await import("@/lib/repositories/password-reset.repo");

    const token = randomToken(32);
    await passwordResetRepository.create({
      userId: user._id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + 60_000),
    });

    await passwordResetService.resetPassword({
      token,
      password: "first new passphrase",
      confirmPassword: "first new passphrase",
    });

    await expect(
      passwordResetService.resetPassword({
        token,
        password: "second new passphrase",
        confirmPassword: "second new passphrase",
      }),
    ).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const { user, passwordResetService } = await setup();
    const { sha256, randomToken } = await import("@/lib/security/hash");
    const { passwordResetRepository } = await import("@/lib/repositories/password-reset.repo");

    const token = randomToken(32);
    await passwordResetRepository.create({
      userId: user._id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() - 1_000),
    });

    await expect(
      passwordResetService.resetPassword({
        token,
        password: "should not apply here",
        confirmPassword: "should not apply here",
      }),
    ).rejects.toThrow();
  });

  it("does not reveal whether an email exists", async () => {
    const { passwordResetService } = await setup();

    const known = await passwordResetService.requestReset(
      { email: "reset@example.com" },
      {},
    );
    const unknown = await passwordResetService.requestReset(
      { email: "nobody@example.com" },
      {},
    );

    expect(known.message).toBe(unknown.message);
  });
});
