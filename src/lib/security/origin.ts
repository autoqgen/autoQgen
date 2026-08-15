import { allowedOrigins } from "@/lib/config/env";
import { ForbiddenError } from "@/lib/errors/app-error";

/**
 * Origin validation — the CSRF control for this application.
 *
 * Auth.js protects its own endpoints with a double-submit token. Everything
 * else is a JSON API consumed by same-origin fetch, so the correct and simplest
 * defence is to require that state-changing requests declare a trusted origin.
 *
 * Why this is sufficient:
 *  - A cross-site form POST cannot send `Content-Type: application/json`
 *    without triggering a CORS preflight, and `defineRoute` already rejects any
 *    body that is not JSON.
 *  - Browsers always attach `Origin` to cross-origin requests and to all
 *    same-origin non-GET requests in current versions; `Sec-Fetch-Site` gives a
 *    second, unforgeable signal.
 *  - An attacker's page cannot set either header.
 *
 * Non-browser clients (curl, server-to-server) send no Origin at all. Those are
 * accepted only when `Sec-Fetch-Site` is absent too, which is the signature of a
 * non-browser caller — a browser never omits both on a cross-site request.
 */

const STATE_CHANGING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isStateChanging(method: string): boolean {
  return STATE_CHANGING.has(method.toUpperCase());
}

export function normaliseOrigin(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export interface OriginCheckResult {
  allowed: boolean;
  reason: "same-origin" | "allowlisted" | "non-browser" | "cross-site" | "unknown-origin";
  origin: string | null;
}

export function checkRequestOrigin(request: Request): OriginCheckResult {
  const method = request.method.toUpperCase();

  if (!isStateChanging(method)) {
    return { allowed: true, reason: "same-origin", origin: null };
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  const origin = normaliseOrigin(request.headers.get("origin"));
  const referer = normaliseOrigin(request.headers.get("referer"));
  const candidate = origin ?? referer;

  // Browsers label same-origin requests explicitly; trust that first.
  if (fetchSite === "same-origin" || fetchSite === "none") {
    return { allowed: true, reason: "same-origin", origin: candidate };
  }

  if (candidate) {
    if (allowedOrigins.includes(candidate)) {
      return { allowed: true, reason: "allowlisted", origin: candidate };
    }
    return { allowed: false, reason: "cross-site", origin: candidate };
  }

  // No Origin, no Referer and no Sec-Fetch-Site: not a browser request.
  if (!fetchSite) {
    return { allowed: true, reason: "non-browser", origin: null };
  }

  return { allowed: false, reason: "unknown-origin", origin: null };
}

export function assertTrustedOrigin(request: Request): OriginCheckResult {
  const result = checkRequestOrigin(request);

  if (!result.allowed) {
    throw new ForbiddenError("This request was blocked because it came from an untrusted origin.");
  }

  return result;
}
