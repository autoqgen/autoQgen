/**
 * Roles and account statuses.
 *
 * Declared as const tuples so the same source of truth drives the TypeScript
 * union, the Zod enum and the Mongoose schema enum. Adding a role in one place
 * is impossible.
 */

export const USER_ROLES = [
  "super_admin",
  "organization_owner",
  "team_admin",
  "teacher",
  "content_writer",
  "reviewer",
  "moderator",
  "student",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "pending", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** The role assigned to every self-registered account. Never client-supplied. */
export const DEFAULT_ROLE: UserRole = "teacher";

/** Roles considered internal staff for taxonomy administration. */
export const STAFF_ROLES: readonly UserRole[] = [
  "super_admin",
  "organization_owner",
  "team_admin",
  "moderator",
];

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && (USER_ROLES as readonly string[]).includes(value);
}

export function isUserStatus(value: unknown): value is UserStatus {
  return typeof value === "string" && (USER_STATUSES as readonly string[]).includes(value);
}
