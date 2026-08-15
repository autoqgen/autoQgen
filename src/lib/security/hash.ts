import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** SHA-256 hex digest. Used for reset-token storage and question de-duplication. */
export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Cryptographically random URL-safe token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** Constant-time comparison for equal-length hex digests. */
export function safeCompareHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Normalises question text for duplicate detection: case-folded, whitespace
 * collapsed, punctuation-insensitive at the edges. Two questions that differ
 * only in spacing or capitalisation produce the same hash.
 */
export function normaliseQuestionText(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Deterministic fingerprint of a question within a chapter.
 *
 * Persisted on the document so a unique index can enforce de-duplication at the
 * database level. The previous project relied on a check-then-insert query,
 * which two concurrent requests could both pass.
 */
export function questionContentHash(chapterId: string, questionText: string): string {
  return sha256(`${chapterId}::${normaliseQuestionText(questionText)}`);
}
