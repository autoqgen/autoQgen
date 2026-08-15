import bcrypt from "bcryptjs";

/**
 * Password hashing and policy.
 *
 * Cost 12 rather than the previous project's 10, and the policy is enforced
 * server-side (it was previously client-only, so the API accepted a
 * one-character password).
 */

const BCRYPT_COST = 12;

/** bcrypt truncates beyond 72 bytes; rejecting longer input also caps CPU cost. */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 72;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Burns roughly the same CPU as a real comparison.
 *
 * Called when no user matches the submitted email so that "unknown account" and
 * "wrong password" take comparable time. Without this the previous project
 * leaked account existence through response timing even once its error messages
 * were unified.
 */
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO1t8Yl7Ck9EAvC2p1Yd0e/8AqK2Q8Qy2";

export async function burnPasswordComparison(plain: string): Promise<void> {
  await bcrypt.compare(plain, DUMMY_HASH).catch(() => false);
}

export interface PasswordPolicyIssue {
  path: string;
  message: string;
}

/**
 * Structural password rules. Deliberately length-first: length dominates
 * entropy, and character-class rules mostly push users toward predictable
 * substitutions.
 */
export function checkPasswordPolicy(password: string): PasswordPolicyIssue[] {
  const issues: PasswordPolicyIssue[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    issues.push({
      path: "password",
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    });
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    issues.push({
      path: "password",
      message: `Password must be at most ${PASSWORD_MAX_LENGTH} characters.`,
    });
  }
  if (/^\s|\s$/.test(password)) {
    issues.push({ path: "password", message: "Password must not start or end with whitespace." });
  }
  if (/^(.)\1+$/.test(password)) {
    issues.push({ path: "password", message: "Password must not be a single repeated character." });
  }

  const COMMON = [
    "password",
    "12345678",
    "qwerty",
    "letmein",
    "welcome",
    "admin123",
    "iloveyou",
    "autoqgen",
  ];
  const lowered = password.toLowerCase();
  if (COMMON.some((entry) => lowered.includes(entry))) {
    issues.push({ path: "password", message: "Password contains a commonly used phrase." });
  }

  return issues;
}
