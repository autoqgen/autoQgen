export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfterSeconds: number;
}

export interface RateLimitRule {
  /** Requests permitted per window. */
  limit: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

/**
 * Storage contract for the limiter.
 *
 * Implemented in-memory for Step 1 and swappable for Redis without touching a
 * single route, because routes only ever see `rateLimit()`.
 */
export interface RateLimitStore {
  /** Increments the counter for `key` and returns the count and window expiry. */
  hit(key: string, windowSeconds: number): Promise<{ count: number; resetAt: number }>;
  /** Releases one previously reserved hit without disturbing other callers. */
  release(key: string): Promise<void>;
  reset(key: string): Promise<void>;
}
