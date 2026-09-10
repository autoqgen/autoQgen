import { MemoryRateLimitStore } from "@/lib/rate-limit/memory-store";
import { RateLimitError } from "@/lib/errors/app-error";
import type { RateLimitResult, RateLimitRule, RateLimitStore } from "@/lib/rate-limit/types";

export type { RateLimitResult, RateLimitRule, RateLimitStore };

/**
 * Named rate-limit policies.
 *
 * The previous project had no throttling at all, which left credential brute
 * force, mass registration, email bombing through forgot-password and unbounded
 * bulk import all wide open.
 */
export const RATE_LIMITS = {
  paperCreate: { limit: 60, windowSeconds: 60 * 60 },
  paperExport: { limit: 60, windowSeconds: 60 * 60 },
  paperGenerate: { limit: 1000, windowSeconds: 60 * 60 },
  login: { limit: 5, windowSeconds: 15 * 60 },
  register: { limit: 3, windowSeconds: 60 * 60 },
  forgotPassword: { limit: 3, windowSeconds: 60 * 60 },
  resetPassword: { limit: 5, windowSeconds: 60 * 60 },
  changePassword: { limit: 5, windowSeconds: 60 * 60 },
  questionCreate: { limit: 60, windowSeconds: 60 * 60 },
  questionBulkImport: { limit: 5, windowSeconds: 60 * 60 },
  // AI generation calls an external free-tier model — keep it modest.
  aiGenerate: { limit: 20, windowSeconds: 60 * 60 },
  aiImport: { limit: 40, windowSeconds: 60 * 60 },
  questionBulkReview: { limit: 30, windowSeconds: 60 * 60 },
  taxonomyWrite: { limit: 60, windowSeconds: 60 * 60 },
  read: { limit: 300, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

const globalForStore = globalThis as unknown as { __autoqgenRateStore?: RateLimitStore };

const store: RateLimitStore =
  globalForStore.__autoqgenRateStore ??
  (globalForStore.__autoqgenRateStore = new MemoryRateLimitStore());

export function getRateLimitStore(): RateLimitStore {
  return globalForStore.__autoqgenRateStore ?? store;
}

/**
 * Replaces the process-local store, e.g. with RedisRateLimitStore at boot.
 *
 * Routes are unaffected: they only ever call `enforceRateLimit`, so swapping the
 * backing store changes nothing above this module.
 */
export function setRateLimitStore(next: RateLimitStore): void {
  globalForStore.__autoqgenRateStore = next;
}

export async function rateLimit(name: RateLimitName, identifier: string): Promise<RateLimitResult> {
  const rule = RATE_LIMITS[name];
  const key = `${name}:${identifier}`;

  const { count, resetAt } = await getRateLimitStore().hit(key, rule.windowSeconds);
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - Date.now()) / 1000));

  return {
    allowed: count <= rule.limit,
    limit: rule.limit,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds,
  };
}

/** Applies a policy and throws RateLimitError when exhausted. */
export async function enforceRateLimit(name: RateLimitName, identifier: string): Promise<void> {
  const result = await rateLimit(name, identifier);
  if (!result.allowed) {
    throw new RateLimitError(result.retryAfterSeconds);
  }
}

/**
 * Best-effort client identifier.
 *
 * Trusts `x-forwarded-for` only for the left-most hop, which is what a single
 * reverse proxy sets. Behind a different topology this must be adjusted.
 */
export function clientIdentifier(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() ?? "unknown";
}
