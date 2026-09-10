/**
 * Pure vector math for semantic similarity.
 *
 * No dependency, no I/O — the whole 300-pair comparison for a 25-question paper
 * runs here in-process after the embeddings are fetched once. Unit-tested.
 */

/** Cosine similarity of two equal-length vectors. Returns 0 for a zero vector. */
export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < n; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  if (normA === 0 || normB === 0) return 0;
  const score = dot / (Math.sqrt(normA) * Math.sqrt(normB));
  // Guard against tiny floating-point overshoot past ±1.
  return score > 1 ? 1 : score < -1 ? -1 : score;
}

export interface SimilarPair {
  /** Lower index of the pair (always `i < j` — never the reverse pair). */
  i: number;
  j: number;
  score: number;
}

/**
 * Every unique unordered pair `(i, j)` with `i < j` whose cosine similarity is
 * `>= threshold`, sorted most-similar first.
 *
 * For N vectors this is exactly `N * (N - 1) / 2` comparisons — `(i, j)` and
 * `(j, i)` are never both produced.
 */
export function pairwiseAboveThreshold(
  vectors: readonly (readonly number[])[],
  threshold: number,
): SimilarPair[] {
  const out: SimilarPair[] = [];
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = i + 1; j < vectors.length; j += 1) {
      const score = cosineSimilarity(vectors[i]!, vectors[j]!);
      if (score >= threshold) out.push({ i, j, score });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

/** Highest cosine similarity of `vector` against any of `others` (0 if none). */
export function maxSimilarity(
  vector: readonly number[],
  others: readonly (readonly number[])[],
): number {
  let max = 0;
  for (const other of others) {
    const score = cosineSimilarity(vector, other);
    if (score > max) max = score;
  }
  return max;
}
