/**
 * Semantic similarity — single source of truth for the tunable constants.
 *
 * Two-stage detection:
 *   1. cosine similarity  — a cheap local CANDIDATE detector
 *   2. Gemini validation  — the FINAL decision on whether a candidate pair is
 *      genuinely the same question/concept
 *
 * `SIMILARITY_CANDIDATE_THRESHOLD` is only the cutoff for stage 1: a pair below
 * it is ignored entirely (never sent to Gemini, never shown). A pair at or above
 * it is a *candidate* — Gemini decides whether it is actually similar. There is
 * deliberately no second numeric "final" threshold; the final decision is
 * boolean and comes from Gemini.
 */

/** Stage 1 cutoff: cosine `>=` this makes a pair a Gemini-validation candidate. */
export const SIMILARITY_CANDIDATE_THRESHOLD = 0.9;

/** How many replacement candidates to try before giving up on a flagged pair. */
export const MAX_REPLACEMENT_ATTEMPTS = 3;

/** 0.951 → 95. Used for every user-facing similarity number (always the cosine score). */
export function toPercent(score: number): number {
  return Math.round(score * 100);
}

/** The candidate threshold as the UI shows it (90). */
export const SIMILARITY_CANDIDATE_THRESHOLD_PERCENT = toPercent(SIMILARITY_CANDIDATE_THRESHOLD);
