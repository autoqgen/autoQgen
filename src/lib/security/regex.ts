/**
 * Escapes every regular-expression metacharacter in a user-supplied string.
 *
 * The previous project built `new RegExp(userInput, "i")` in three places, which
 * allowed catastrophic backtracking (`(a+)+$`) to pin a CPU core and stall the
 * event loop for the whole instance. Nothing in this project constructs a RegExp
 * from untrusted input without passing through here first.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Builds a case-insensitive, anchored-prefix matcher for short lookups such as
 * "find the subject named X". Input is escaped and length-capped.
 */
export function safeNameRegExp(value: string, maxLength = 120): RegExp {
  const trimmed = value.trim().slice(0, maxLength);
  return new RegExp(`^${escapeRegExp(trimmed)}$`, "i");
}
