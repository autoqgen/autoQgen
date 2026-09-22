import type { RateLimitStore } from "@/lib/rate-limit/types";

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Process-local fixed-window store.
 *
 * Adequate for development and single-instance deployments. It is explicitly
 * NOT correct behind multiple instances — each instance keeps its own counters.
 * That limitation is the reason the store sits behind an interface: swapping in
 * Redis is a one-file change.
 *
 * Deliberately not filesystem-backed; the previous project's file-based state
 * was one of the reasons it could not be scaled horizontally.
 */
export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = Date.now();

  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  async hit(key: string, windowSeconds: number): Promise<{ count: number; resetAt: number }> {
    const now = Date.now();
    this.sweep(now);

    const existing = this.buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      const bucket: Bucket = { count: 1, resetAt: now + windowSeconds * 1000 };
      this.buckets.set(key, bucket);
      return { count: bucket.count, resetAt: bucket.resetAt };
    }

    existing.count += 1;
    return { count: existing.count, resetAt: existing.resetAt };
  }

  async reset(key: string): Promise<void> {
    this.buckets.delete(key);
  }

  async release(key: string): Promise<void> {
    const bucket = this.buckets.get(key);
    if (!bucket) return;
    if (bucket.count <= 1) this.buckets.delete(key);
    else bucket.count -= 1;
  }

  /** Test helper. */
  clear(): void {
    this.buckets.clear();
  }
}
