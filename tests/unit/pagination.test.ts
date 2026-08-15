import { describe, expect, it } from "vitest";

import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  paginationQuerySchema,
  toSkip,
} from "@/lib/validation/common";

/**
 * Regression tests for the previous project's unbounded pagination:
 * `parseInt(searchParams.get("limit") || "10")` with no clamp and no NaN guard,
 * so `?limit=1000000` was honoured verbatim and `?limit=abc` reached Mongo as
 * `.limit(NaN)`.
 */
describe("pagination query", () => {
  it("applies defaults when nothing is supplied", () => {
    const result = paginationQuerySchema.parse({});
    expect(result.page).toBe(1);
    expect(result.limit).toBe(DEFAULT_PAGE_SIZE);
  });

  it("accepts valid values", () => {
    const result = paginationQuerySchema.parse({ page: "3", limit: "50" });
    expect(result.page).toBe(3);
    expect(result.limit).toBe(50);
  });

  it("caps limit at the hard maximum", () => {
    expect(paginationQuerySchema.parse({ limit: String(MAX_PAGE_SIZE) }).limit).toBe(MAX_PAGE_SIZE);
    expect(paginationQuerySchema.parse({ limit: "1000000" }).limit).toBe(DEFAULT_PAGE_SIZE);
    expect(paginationQuerySchema.parse({ limit: "101" }).limit).toBe(DEFAULT_PAGE_SIZE);
  });

  it("falls back safely on hostile or malformed input", () => {
    for (const value of ["abc", "-5", "0", "NaN", "1e99", "", "  "]) {
      const result = paginationQuerySchema.parse({ page: value, limit: value });
      expect(Number.isInteger(result.page)).toBe(true);
      expect(result.page).toBeGreaterThanOrEqual(1);
      expect(result.limit).toBeGreaterThanOrEqual(1);
      expect(result.limit).toBeLessThanOrEqual(MAX_PAGE_SIZE);
    }
  });

  it("never produces a negative skip", () => {
    expect(toSkip(1, 20)).toBe(0);
    expect(toSkip(3, 20)).toBe(40);
  });
});
