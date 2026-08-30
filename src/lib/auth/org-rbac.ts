import type { OrgRole } from "@/types/organization";

/**
 * Organization-governance permission matrix.
 *
 * Deliberately separate from `src/lib/auth/rbac.ts`. That file answers "what
 * can this account do on the platform" (create a question, review a paper,
 * ...) via the global `User.role`. This file answers a different question:
 * "what can this account do *inside organization X*", via their
 * `OrganizationMember.role` in that specific org. A `student`-role member of
 * an organization has zero permissions here regardless of their global role —
 * governance and content-capability are orthogonal concerns.
 */

export const ORG_PERMISSIONS = [
  "organization:read",
  "organization:update",

  "members:read",
  "members:invite",
  "members:update",
  "members:remove",

  "teams:create",
  "teams:read",
  "teams:update",
  "teams:remove",

  "roles:assign",
  "invitations:manage",

  // Team-scoped subset available to a Team Admin for their own team only.
  "team:read",
  "team:update",
  "team:members:manage",

  /**
   * Content-capability equivalents of rbac.ts's `question:read` / `paper:create`.
   * Deliberately named identically to the global `Permission` they mirror —
   * holding this org permission grants the *same* capability, just sourced
   * from organization membership instead of the global role. Consumed only by
   * `hasPermissionOrOrgMembership()` in org-session.ts as a fallback when the
   * caller's global role alone doesn't already grant it (e.g. the default
   * `member` role, which holds zero platform permissions). This does NOT
   * scope *which* organization's questions/papers are visible — no content
   * model gained an `organizationId` for this; it only answers "is this
   * capability unlocked at all."
   */
  "question:read",
  "paper:create",
] as const;

export type OrgPermission = (typeof ORG_PERMISSIONS)[number];

/** Full organization governance. Assigned only via Super Admin owner-assignment. */
const ORGANIZATION_OWNER: OrgPermission[] = [...ORG_PERMISSIONS];

/**
 * Team Admin governs their assigned team only — never org-wide membership,
 * invitations, or role assignment. `teams:read` lets them see the list of
 * teams (to know their own place in it); `team:*`/`team:members:manage`
 * apply only to the team referenced by their own membership row, enforced by
 * `requireTeamPermission` in org-session.ts, not by this table alone.
 */
const TEAM_ADMIN: OrgPermission[] = [
  "teams:read",
  "team:read",
  "team:update",
  "team:members:manage",
  "question:read",
  "paper:create",
];

/**
 * Ordinary organization members (including the default `member` org role)
 * hold no governance permissions, but any active membership — regardless of
 * which of these roles it is — unlocks baseline content capability: viewing
 * questions and creating papers, in place of a global role that may grant
 * neither (e.g. a freshly registered `member`).
 */
const ORDINARY_MEMBER: OrgPermission[] = ["question:read", "paper:create"];

export const ORG_ROLE_PERMISSIONS: Record<OrgRole, readonly OrgPermission[]> = {
  organization_owner: ORGANIZATION_OWNER,
  team_admin: TEAM_ADMIN,
  teacher: ORDINARY_MEMBER,
  content_writer: ORDINARY_MEMBER,
  reviewer: ORDINARY_MEMBER,
  moderator: ORDINARY_MEMBER,
  student: ORDINARY_MEMBER,
  member: ORDINARY_MEMBER,
};

export function canInOrg(role: OrgRole, permission: OrgPermission): boolean {
  return ORG_ROLE_PERMISSIONS[role].includes(permission);
}

export function canAnyInOrg(role: OrgRole, permissions: readonly OrgPermission[]): boolean {
  return permissions.some((permission) => canInOrg(role, permission));
}
