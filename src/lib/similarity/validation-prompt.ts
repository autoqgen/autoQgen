/**
 * Gemini semantic-validation prompt for similarity candidate pairs.
 *
 * Pure and deterministic — no network, no imports — so it can be unit-tested.
 * Cosine similarity has already decided these pairs are *candidates*; Gemini
 * makes the final call on whether each pair is genuinely the same question.
 */

export interface SimilarityCandidatePair {
  a: string;
  b: string;
}

export interface SimilarityVerdict {
  isSimilar: boolean;
  /** Gemini's own 0-100 confidence — an internal signal, never shown as the score. */
  confidence: number;
  reason: string;
}

export const SIMILARITY_VALIDATION_SYSTEM_PROMPT = `You compare pairs of exam questions and decide, for EACH pair independently, whether the two questions are essentially asking the SAME question / testing the SAME underlying concept.

Base the decision ONLY on:
- what knowledge each question tests
- the underlying concept being asked
- whether a student would give substantially the SAME answer to both
- whether the wording differs but the intended answer/concept is the same

Two questions are the SAME (isSimilar = true) when:
- they ask essentially the same thing
- they test the same underlying concept
- one is basically a reworded version of the other
- a student would give substantially the same answer to both

Two questions are DIFFERENT (isSimilar = false) — do NOT mark them similar — merely because:
- they belong to the same subject, chapter, topic or broad domain
- they are both about the same field (Islam, religion, science, history, ...)
- they share similar words
- their answers are related but represent different concepts

Respond with STRICT JSON only — no prose, no markdown fences — in exactly this shape:
{ "verdicts": [ { "index": <number>, "isSimilar": <true|false>, "confidence": <0-100>, "reason": "<short explanation>" } ] }
Return exactly one verdict object per input pair, with "index" matching the pair number given.`;

export function buildSimilarityValidationPrompt(
  pairs: readonly SimilarityCandidatePair[],
  startIndex = 0,
): string {
  const blocks = pairs.map((pair, index) => {
    const a = pair.a.replace(/\s+/g, " ").trim().slice(0, 1500);
    const b = pair.b.replace(/\s+/g, " ").trim().slice(0, 1500);
    return `PAIR ${startIndex + index}:\nQuestion A: ${a}\nQuestion B: ${b}`;
  });
  return `Evaluate the following ${pairs.length} candidate pair(s). For each, decide isSimilar per the rules.\n\n${blocks.join(
    "\n\n",
  )}`;
}

/**
 * Normalises whatever Gemini returned into exactly `count` verdicts, one per
 * input pair index. Anything missing or malformed becomes `isSimilar: false`
 * (fail-closed — an unreadable answer must not create a false positive).
 */
export function parseValidationVerdicts(raw: unknown, count: number, startIndex = 0): SimilarityVerdict[] {
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === "object" && Array.isArray((raw as { verdicts?: unknown[] }).verdicts)
      ? (raw as { verdicts: unknown[] }).verdicts
      : raw && typeof raw === "object" && Array.isArray((raw as { results?: unknown[] }).results)
        ? (raw as { results: unknown[] }).results
        : [];

  const byIndex = new Map<number, Record<string, unknown>>();
  list.forEach((entry, position) => {
    if (!entry || typeof entry !== "object") return;
    const row = entry as Record<string, unknown>;
    const idx = Number.isInteger(row.index) ? (row.index as number) : startIndex + position;
    byIndex.set(idx, row);
  });

  const out: SimilarityVerdict[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = byIndex.get(startIndex + i);
    if (!row) {
      out.push({ isSimilar: false, confidence: 0, reason: "no verdict returned" });
      continue;
    }
    const confidence = Number(row.confidence);
    out.push({
      isSimilar: row.isSimilar === true,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, Math.round(confidence))) : 0,
      reason: typeof row.reason === "string" ? row.reason.slice(0, 500) : "",
    });
  }
  return out;
}
