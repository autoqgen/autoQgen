import type { RateLimitStore } from "@/lib/rate-limit/types";

/**
 * Redis-backed rate limiting.
 *
 * Deliberately written against a minimal client interface rather than importing
 * a specific driver, so the project takes on no Redis dependency and any of
 * ioredis, node-redis or an Upstash HTTP client can be injected:
 *
 *   import Redis from "ioredis";
 *   import { setRateLimitStore } from "@/lib/rate-limit";
 *   import { RedisRateLimitStore } from "@/lib/rate-limit/redis-store";
 *
 *   setRateLimitStore(new RedisRateLimitStore(new Redis(process.env.REDIS_URL)));
 *
 * INCR followed by a conditional EXPIRE is the standard fixed-window pattern and
 * is atomic per key, so counters are correct across any number of instances —
 * which the in-memory store cannot be.
 */

export interface RedisLikeClient {
  incr(key: string): Promise<number>;
  pttl(key: string): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<unknown>;
  del(key: string): Promise<unknown>;
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(
    private readonly client: RedisLikeClient,
    private readonly prefix = "autoqgen:rl:",
  ) {}

  async hit(key: string, windowSeconds: number): Promise<{ count: number; resetAt: number }> {
    const namespaced = `${this.prefix}${key}`;
    const windowMs = windowSeconds * 1000;

    const count = await this.client.incr(namespaced);

    if (count === 1) {
      // First hit in this window — set the expiry that defines the window.
      await this.client.pexpire(namespaced, windowMs);
      return { count, resetAt: Date.now() + windowMs };
    }

    const ttl = await this.client.pttl(namespaced);

    // -1 means the key exists without a TTL, which can only happen if an
    // EXPIRE was lost. Re-apply it rather than letting the key block forever.
    if (ttl < 0) {
      await this.client.pexpire(namespaced, windowMs);
      return { count, resetAt: Date.now() + windowMs };
    }

    return { count, resetAt: Date.now() + ttl };
  }

  async reset(key: string): Promise<void> {
    await this.client.del(`${this.prefix}${key}`);
  }
}
