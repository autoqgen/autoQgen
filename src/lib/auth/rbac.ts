import type { UserRole } from "@/types/roles";

/**
 * Centralised permission matrix.
 *
 * Authorization is expressed once, here, and consumed by `withAuth` and by the
 * service layer. Routes never hand-roll `if (session.user.role === ...)` checks,
 * which is how the previous project ended up with a role field that no code
 * read at all.
 */

export const PERMISSIONS = [
  // Taxonomy
  "taxonomy:read",
  "taxonomy:create",
  "taxonomy:update",
  "taxonomy:delete",

  // Questions
  "question:read",
  "question:read-answers",
  "question:create",
  "question:update:own",
  "question:update:any",
  "question:delete:own",
  "question:delete:any",
  "question:review",
  "question:bulk-import",

  // Question papers
  "paper:read",
  "paper:create",
  "paper:update:own",
  "paper:update:any",
  "paper:delete:own",
  "paper:delete:any",
  "paper:publish",
  "paper:export",
  "paper:export-answers",

  // Audit
  "audit:read",

  // Users
  "user:read:any",
  "user:manage-roles",

  // Organizations (platform-level; see src/lib/auth/org-rbac.ts for
  // per-organization governance permissions, which are a separate matrix).
  "organization:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/**
 * Newly self-registered accounts before they have any real role or
 * organization membership. Deliberately holds zero platform permissions —
 * not even reading a question — until either an administrator assigns a
 * real global role, or the account gains organization-scoped capability
 * through an OrganizationMember row (see org-rbac.ts, a wholly separate
 * matrix). Account/profile/settings/invitation actions are not gated by a
 * `Permission` at all (see session.ts, auth.service.ts) — a `member` can
 * already do all of that simply by being authenticated.
 */
const MEMBER: Permission[] = [];

const STUDENT: Permission[] = ["taxonomy:read", "question:read"];

const CONTENT_WRITER: Permission[] = [
  ...STUDENT,
  "question:read-answers",
  "question:create",
  "question:update:own",
  "question:delete:own",
  "paper:read",
  "paper:create",
  "paper:update:own",
  "paper:delete:own",
  "paper:export",
];

const TEACHER: Permission[] = [...CONTENT_WRITER, "paper:export-answers"];

const REVIEWER: Permission[] = [
  ...TEACHER,
  "question:update:any",
  "question:review",
  "paper:update:any",
];

const MODERATOR: Permission[] = [
  ...REVIEWER,
  "question:delete:any",
  "taxonomy:create",
  "taxonomy:update",
  "paper:delete:any",
  "paper:publish",
];

/**
 * `user:read:any`, `user:manage-roles` and `audit:read` are platform-admin
 * permissions and are deliberately NOT granted here. Before this, both global
 * ranks held every platform permission (organization_owner was, in effect,
 * indistinguishable from super_admin) purely because they predate the
 * per-organization role system in org-rbac.ts — being an org's owner or team
 * admin must never imply platform-wide Admin Center access. Their own
 * organization's governance permissions live entirely in org-rbac.ts.
 */
const TEAM_ADMIN: Permission[] = [
  ...MODERATOR,
  "question:bulk-import",
  "taxonomy:delete",
];

const ORGANIZATION_OWNER: Permission[] = [...TEAM_ADMIN];

const SUPER_ADMIN: Permission[] = [...PERMISSIONS];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  super_admin: SUPER_ADMIN,
  organization_owner: ORGANIZATION_OWNER,
  team_admin: TEAM_ADMIN,
  moderator: MODERATOR,
  reviewer: REVIEWER,
  teacher: TEACHER,
  content_writer: CONTENT_WRITER,
  student: STUDENT,
  member: MEMBER,
};

export function can(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

export function canAny(role: UserRole, permissions: readonly Permission[]): boolean {
  return permissions.some((permission) => can(role, permission));
}

export function canAll(role: UserRole, permissions: readonly Permission[]): boolean {
  return permissions.every((permission) => can(role, permission));
}

/**
 * Ownership-aware check for the `:own` / `:any` permission pairs.
 *
 * Generalised in Step 2 so question papers reuse the identical rule rather than
 * growing a parallel copy. Template-literal types resolve the arguments to real
 * members of Permission, so a typo is a compile error.
 */
export function canActOnResource(
  role: UserRole,
  action: "update" | "delete",
  actorId: string,
  ownerId: string,
  resource: "question" | "paper" = "question",
): boolean {
  if (resource === "paper") {
    if (can(role, `paper:${action}:any`)) return true;
    return can(role, `paper:${action}:own`) && actorId === ownerId;
  }

  if (can(role, `question:${action}:any`)) return true;
  return can(role, `question:${action}:own`) && actorId === ownerId;
}

/** Only these roles may export a paper containing the answer key. */
export function canExportAnswers(role: UserRole): boolean {
  return can(role, "paper:export-answers");
}

/** Only these roles may ever see a stored answer key. */
export function canReadAnswers(role: UserRole): boolean {
  return can(role, "question:read-answers");
}
