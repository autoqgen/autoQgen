/**
 * Organization-membership roles and statuses.
 *
 * Deliberately separate from `src/types/roles.ts`. `UserRole` is a global,
 * platform-wide capability rank (can this account create/review questions at
 * all) that every existing seed, test and permission check already depends
 * on — it is not touched by the organization feature. `OrgRole` is a role
 * held by a (user, organization) pair via `OrganizationMember`, governing
 * organization *governance* only (invite members, manage teams, ...). The two
 * happen to share string vocabulary but are otherwise unrelated: a global
 * `teacher` can be the `organization_owner` of one org and a `student` in
 * another, independent of their global role.
 *
 * `ORG_ROLES` must stay in sync with `USER_ROLES` minus `"super_admin"` —
 * `super_admin` is a platform-only concept and must never be assignable at
 * the organization level.
 */

export const ORG_ROLES = [
  "organization_owner",
  "team_admin",
  "teacher",
  "content_writer",
  "reviewer",
  "moderator",
  "student",
  "member",
] as const;

export type OrgRole = (typeof ORG_ROLES)[number];

/**
 * Roles an Organization Owner may assign to someone else (via invitation or
 * role change). Excludes `organization_owner` itself — owner assignment is a
 * Super Admin action (`POST /api/admin/organizations/:id/owner`) so an owner
 * can never mint a co-owner or lock out the person who put them in charge.
 */
export const ORG_ASSIGNABLE_BY_OWNER: readonly OrgRole[] = ORG_ROLES.filter(
  (role) => role !== "organization_owner",
);

export const ORG_MEMBER_STATUSES = ["active", "suspended"] as const;
export type OrgMemberStatus = (typeof ORG_MEMBER_STATUSES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "rejected", "expired", "cancelled"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === "string" && (ORG_ROLES as readonly string[]).includes(value);
}

export function isOrgAssignableRole(value: unknown): value is OrgRole {
  return typeof value === "string" && (ORG_ASSIGNABLE_BY_OWNER as readonly string[]).includes(value);
}
