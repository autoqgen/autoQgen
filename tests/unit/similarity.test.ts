import { describe, expect, it } from "vitest";

import { cosineSimilarity, maxSimilarity, pairwiseAboveThreshold } from "@/lib/similarity/cosine";
import {
  SIMILARITY_CANDIDATE_THRESHOLD,
  SIMILARITY_CANDIDATE_THRESHOLD_PERCENT,
  toPercent,
} from "@/lib/similarity/config";
import {
  buildSimilarityValidationPrompt,
  parseValidationVerdicts,
} from "@/lib/similarity/validation-prompt";

describe("cosineSimilarity", () => {
  it("is 1 for identical vectors and 0 for orthogonal ones", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
  });

  it("is symmetric and handles a zero vector", () => {
    expect(cosineSimilarity([2, 1], [1, 3])).toBeCloseTo(cosineSimilarity([1, 3], [2, 1]), 12);
    expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
  });

  it("clamps tiny floating-point overshoot to [-1, 1]", () => {
    const v = [0.1, 0.2, 0.3, 0.4];
    expect(cosineSimilarity(v, v)).toBeLessThanOrEqual(1);
    expect(cosineSimilarity(v, [-0.1, -0.2, -0.3, -0.4])).toBeGreaterThanOrEqual(-1);
  });
});

describe("pairwiseAboveThreshold", () => {
  // 5 near-orthogonal basis vectors; make #1 and #3 nearly identical.
  const vectors = [
    [1, 0, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0.02], // ~identical to index 1
    [0, 0, 0, 0, 1],
  ];

  it("returns only unique i<j candidate pairs above the threshold, most similar first", () => {
    const pairs = pairwiseAboveThreshold(vectors, SIMILARITY_CANDIDATE_THRESHOLD);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]!.i).toBe(1);
    expect(pairs[0]!.j).toBe(3);
    // Never the reverse pair.
    expect(pairs.some((p) => p.i >= p.j)).toBe(false);
  });

  it("does exactly N*(N-1)/2 comparisons (no reverse, no self)", () => {
    const n = 25;
    const orthonormal = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, k) => (k === i ? 1 : 0)),
    );
    const pairs = pairwiseAboveThreshold(orthonormal, SIMILARITY_CANDIDATE_THRESHOLD);
    expect(pairs).toHaveLength(0); // 300 pairs considered, none are candidates
  });

  it("uses a strict >= cutoff at exactly 0.90", () => {
    const unit = (c: number) => [c, Math.sqrt(1 - c * c)];
    const below = [[1, 0], unit(0.8999)]; // cosine 0.8999 -> ignore
    const at = [[1, 0], unit(0.9)]; // cosine exactly 0.90 -> candidate
    expect(pairwiseAboveThreshold(below, SIMILARITY_CANDIDATE_THRESHOLD)).toHaveLength(0);
    expect(pairwiseAboveThreshold(at, SIMILARITY_CANDIDATE_THRESHOLD)).toHaveLength(1);
  });
});

describe("maxSimilarity", () => {
  it("returns the highest score against the set, or 0 for an empty set", () => {
    expect(maxSimilarity([1, 0], [[0, 1], [1, 0.01]])).toBeGreaterThan(0.99);
    expect(maxSimilarity([1, 0], [])).toBe(0);
  });
});

describe("candidate threshold config", () => {
  it("is the single 0.90 candidate threshold, shown as 90%", () => {
    expect(SIMILARITY_CANDIDATE_THRESHOLD).toBe(0.9);
    expect(toPercent(0.9)).toBe(90);
    expect(SIMILARITY_CANDIDATE_THRESHOLD_PERCENT).toBe(90);
    expect(toPercent(0.9336)).toBe(93);
    expect(toPercent(0.951)).toBe(95);
  });
});

describe("validation prompt", () => {
  it("lists every candidate pair with both texts and the count", () => {
    const prompt = buildSimilarityValidationPrompt([
      { a: "What is Shirk in Islam?", b: "What is associating partners with Allah?" },
      { a: "What is Nifaq?", b: "What is Shirk?" },
    ]);
    expect(prompt).toContain("2 candidate pair");
    expect(prompt).toContain("PAIR 0:");
    expect(prompt).toContain("PAIR 1:");
    expect(prompt).toContain("What is Shirk in Islam?");
    expect(prompt).toContain("What is Nifaq?");
  });
});

describe("parseValidationVerdicts", () => {
  it("reads a bare array, a {verdicts:[…]} object, and indexed entries", () => {
    expect(parseValidationVerdicts([{ isSimilar: true, confidence: 90 }], 1)[0]!.isSimilar).toBe(true);
    const wrapped = parseValidationVerdicts(
      { verdicts: [{ index: 1, isSimilar: true, confidence: 88, reason: "r" }, { index: 0, isSimilar: false }] },
      2,
    );
    expect(wrapped[0]!.isSimilar).toBe(false);
    expect(wrapped[1]!.isSimilar).toBe(true);
  });

  it("fails closed: missing / malformed entries become isSimilar:false", () => {
    expect(parseValidationVerdicts([{ isSimilar: true }], 3)).toEqual([
      { isSimilar: true, confidence: 0, reason: "" },
      { isSimilar: false, confidence: 0, reason: "no verdict returned" },
      { isSimilar: false, confidence: 0, reason: "no verdict returned" },
    ]);
    expect(parseValidationVerdicts("not json", 1)[0]!.isSimilar).toBe(false);
    expect(parseValidationVerdicts(null, 1)[0]!.isSimilar).toBe(false);
  });

  it("clamps confidence to 0-100 and only treats literal true as similar", () => {
    const v = parseValidationVerdicts([{ isSimilar: "true", confidence: 250 }], 1)[0]!;
    expect(v.isSimilar).toBe(false); // string "true" is not boolean true
    expect(v.confidence).toBe(100);
  });
});
