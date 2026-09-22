import { beforeEach, describe, expect, it } from "vitest";

import { MemoryRateLimitStore } from "@/lib/rate-limit/memory-store";
import { RATE_LIMITS } from "@/lib/rate-limit";

describe("rate limit store", () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
  });

  it("counts hits inside a window", async () => {
    const first = await store.hit("login:1.2.3.4", 60);
    const second = await store.hit("login:1.2.3.4", 60);

    expect(first.count).toBe(1);
    expect(second.count).toBe(2);
    expect(second.resetAt).toBe(first.resetAt);
  });

  it("keeps separate counters per key", async () => {
    await store.hit("login:a", 60);
    await store.hit("login:a", 60);
    const other = await store.hit("login:b", 60);

    expect(other.count).toBe(1);
  });

  it("resets a key on demand", async () => {
    await store.hit("login:a", 60);
    await store.reset("login:a");
    expect((await store.hit("login:a", 60)).count).toBe(1);
  });

  it("releases one reservation without clearing concurrent hits", async () => {
    await store.hit("signupSuccess:a", 60);
    await store.hit("signupSuccess:a", 60);
    await store.release("signupSuccess:a");
    expect((await store.hit("signupSuccess:a", 60)).count).toBe(2);
  });

  it("defines a policy for every sensitive operation", () => {
    for (const name of [
      "login",
      "register",
      "signupRequest",
      "signupSuccess",
      "forgotPassword",
      "questionCreate",
      "questionBulkImport",
    ] as const) {
      expect(RATE_LIMITS[name].limit).toBeGreaterThan(0);
      expect(RATE_LIMITS[name].windowSeconds).toBeGreaterThan(0);
    }
  });

  it("keeps the login budget tight enough to blunt brute force", () => {
    expect(RATE_LIMITS.login.limit).toBeLessThanOrEqual(10);
  });

  it("uses the requested signup defaults", () => {
    expect(RATE_LIMITS.signupRequest).toEqual({ limit: 10, windowSeconds: 15 * 60 });
    expect(RATE_LIMITS.signupSuccess).toEqual({ limit: 5, windowSeconds: 60 * 60 });
  });
});
