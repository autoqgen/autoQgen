import { describe, expect, it } from "vitest";

import { checkRequestOrigin, isStateChanging, normaliseOrigin } from "@/lib/security/origin";

/**
 * Origin validation is the CSRF control introduced in Step 2. These cases pin
 * the exact behaviour so a future change cannot quietly widen it.
 *
 * tests/setup.ts sets NEXTAUTH_URL to http://localhost:3000, which is therefore
 * the trusted origin here.
 */

const TRUSTED = "http://localhost:3000";

function request(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost:3000/api/questions", { method, headers });
}

describe("isStateChanging", () => {
  it("treats reads as safe and writes as state-changing", () => {
    expect(isStateChanging("GET")).toBe(false);
    expect(isStateChanging("HEAD")).toBe(false);
    expect(isStateChanging("POST")).toBe(true);
    expect(isStateChanging("put")).toBe(true);
    expect(isStateChanging("DELETE")).toBe(true);
  });
});

describe("normaliseOrigin", () => {
  it("reduces a URL to its origin and drops a trailing slash", () => {
    expect(normaliseOrigin("http://localhost:3000/some/path")).toBe(TRUSTED);
    expect(normaliseOrigin("garbage")).toBeNull();
    expect(normaliseOrigin(null)).toBeNull();
  });
});

describe("checkRequestOrigin", () => {
  it("always allows safe methods", () => {
    expect(checkRequestOrigin(request("GET", { origin: "https://evil.test" })).allowed).toBe(true);
  });

  it("allows a same-origin write", () => {
    const result = checkRequestOrigin(request("POST", { origin: TRUSTED }));
    expect(result.allowed).toBe(true);
  });

  it("blocks a cross-site write", () => {
    const result = checkRequestOrigin(request("POST", { origin: "https://evil.test" }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("cross-site");
  });

  it("blocks a cross-site write identified only by Referer", () => {
    const result = checkRequestOrigin(request("POST", { referer: "https://evil.test/page" }));
    expect(result.allowed).toBe(false);
  });

  it("trusts the browser's own same-origin label", () => {
    const result = checkRequestOrigin(
      request("POST", { "sec-fetch-site": "same-origin", origin: TRUSTED }),
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("same-origin");
  });

  it("blocks a cross-site request even when it omits Origin", () => {
    const result = checkRequestOrigin(request("POST", { "sec-fetch-site": "cross-site" }));
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("unknown-origin");
  });

  it("allows a non-browser client that sends no browser headers at all", () => {
    const result = checkRequestOrigin(request("POST"));
    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("non-browser");
  });
});
