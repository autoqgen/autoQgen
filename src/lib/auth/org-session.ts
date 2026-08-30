import { Types } from "mongoose";

import type { AuthContext } from "@/lib/auth/session";
import { canInOrg, type OrgPermission } from "@/lib/auth/org-rbac";
import { can, type Permission } from "@/lib/auth/rbac";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { Organization, OrganizationMember, type IOrganizationMember } from "@/models";

/**
 * Organization-membership resolution and authorization.
 *
 * Mirrors `src/lib/auth/session.ts`'s shape (requireX / assertX helpers) but
 * for organization governance instead of platform permissions. A missing or
 * inactive membership is reported as `NotFoundError`, not `ForbiddenError` —
 * the same "don't disclose existence to non-members" convention
 * `paper.service.ts` already uses for non-owned, non-published papers, so a
 * user probing a foreign organization's id learns nothing about it.
 */

export type OrgMembership = IOrganizationMember;

/**
 * The organization a request should act on, resolved server-side.
 *
 * Falls back to the caller's first active membership when they have no
 * "current organization" pointer set (or it's stale/no longer valid) — never
 * trusts a client-supplied organization id for this resolution.
 */
export async function resolveCurrentOrganizationId(user: AuthContext): Promise<string | null> {
  if (user.organizationId) {
    const membership = await OrganizationMember.exists({
      userId: user.objectId,
      organizationId: user.organizationId,
      status: "active",
    }).exec();
    if (membership) return user.organizationId;
  }

  const fallback = await OrganizationMember.findOne({ userId: user.objectId, status: "active" })
    .sort({ createdAt: 1 })
    .select("organizationId")
    .lean()
    .exec();

  return fallback ? fallback.organizationId.toString() : null;
}

/** Like resolveCurrentOrganizationId, but throws when the user has none. */
export async function requireCurrentOrganizationId(user: AuthContext): Promise<string> {
  const organizationId = await resolveCurrentOrganizationId(user);
  if (!organizationId) {
    throw new ValidationError("You must belong to an organization to do this. Select or join one first.");
  }
  return organizationId;
}

/**
 * The organization whose academic content (taxonomy, questions, papers) a
 * request should act on — the tenant boundary for the whole content stack.
 *
 * - Non-admin callers: their current organization, exactly as
 *   `resolveCurrentOrganizationId` resolves it. No organization ⇒ `null`.
 * - `super_admin`: the platform administrator may operate inside any tenant.
 *   An explicit `override` id wins (Admin Center, migration/seed scripts);
 *   otherwise their `User.organization` pointer is trusted directly, even
 *   without a membership row, so switching into an org they don't belong to
 *   still scopes their content view. `null` when they have neither.
 *
 * Returns `null` instead of throwing so list endpoints can render an empty
 * "select an organization" state; write paths use
 * `requireContentOrganizationId`.
 */
export async function resolveContentOrganizationId(
  user: AuthContext,
  override?: string | null,
): Promise<string | null> {
  if (user.role === "super_admin") {
    const target = (override && override.trim()) || user.organizationId;
    if (!target || !Types.ObjectId.isValid(target)) return null;
    const exists = await Organization.exists({ _id: target }).exec();
    return exists ? String(target) : null;
  }
  return resolveCurrentOrganizationId(user);
}

/** Throwing counterpart of `resolveContentOrganizationId`, for write paths. */
export async function requireContentOrganizationId(
  user: AuthContext,
  override?: string | null,
): Promise<string> {
  const organizationId = await resolveContentOrganizationId(user, override);
  if (!organizationId) {
    throw new ValidationError(
      "You must belong to an organization to manage academic content. Select or join one first.",
    );
  }
  return organizationId;
}

export async function getMembership(
  userId: Types.ObjectId,
  organizationId: string,
): Promise<OrgMembership | null> {
  if (!Types.ObjectId.isValid(organizationId)) return null;
  return OrganizationMember.findOne({ userId, organizationId, status: "active" }).exec();
}

export async function requireOrgMembership(
  user: AuthContext,
  organizationId: string,
): Promise<OrgMembership> {
  const membership = await getMembership(user.objectId, organizationId);
  if (!membership) {
    throw new NotFoundError("Organization not found.");
  }
  return membership;
}

/**
 * Server-component page guard: returns the caller's membership when they
 * belong to an organization and hold the permission, or null otherwise (no
 * current organization, or insufficient role) — collapsed into one outcome
 * since a page only needs to decide "render" vs. "show access denied".
 */
export async function resolveOrgPageAccess(
  user: AuthContext,
  permission: OrgPermission,
): Promise<OrgMembership | null> {
  const organizationId = await resolveCurrentOrganizationId(user);
  if (!organizationId) return null;

  const membership = await getMembership(user.objectId, organizationId);
  if (!membership || !canInOrg(membership.role, permission)) return null;

  return membership;
}

export async function requireOrgPermission(
  user: AuthContext,
  organizationId: string,
  permission: OrgPermission,
): Promise<OrgMembership> {
  const membership = await requireOrgMembership(user, organizationId);
  if (!canInOrg(membership.role, permission)) {
    throw new ForbiddenError();
  }
  return membership;
}

/**
 * Bridges the two permission systems for a small, explicit set of content
 * capabilities that a plain `member` gains only once they belong to an
 * organization — never a generic replacement for `can()`/`assertPermission()`
 * in rbac.ts, which every other permission still uses unchanged.
 *
 * Grants the capability when EITHER:
 *   - the caller's global role already holds `globalPermission` (the existing,
 *     untouched rbac.ts check — always tried first, so nothing that worked
 *     before this existed can start failing), OR
 *   - the caller has an active organization membership whose org-role holds
 *     the org-scoped `orgPermission` (see org-rbac.ts).
 *
 * This does not scope *which* organization's data is visible — no content
 * model carries an `organizationId`. It only answers "is this capability
 * unlocked at all for this account right now."
 */
export async function hasPermissionOrOrgMembership(
  user: AuthContext | null,
  globalPermission: Permission,
  orgPermission: OrgPermission,
): Promise<boolean> {
  if (!user) return false;
  if (can(user.role, globalPermission)) return true;

  const organizationId = await resolveCurrentOrganizationId(user);
  if (!organizationId) return false;

  const membership = await getMembership(user.objectId, organizationId);
  return Boolean(membership && canInOrg(membership.role, orgPermission));
}

/** Throwing counterpart of `hasPermissionOrOrgMembership`. */
export async function assertPermissionOrOrgMembership(
  user: AuthContext | null,
  globalPermission: Permission,
  orgPermission: OrgPermission,
): Promise<void> {
  if (!(await hasPermissionOrOrgMembership(user, globalPermission, orgPermission))) {
    throw new ForbiddenError();
  }
}

/**
 * Team-scoped variant: an `organization_owner` may act on any team in their
 * organization; a `team_admin` may act only on the single team referenced by
 * their own membership row. No other role ever holds `team:*` permissions
 * per `ORG_ROLE_PERMISSIONS`, so this function never needs to special-case
 * them.
 */
export function assertTeamPermission(
  membership: OrgMembership,
  teamId: string,
  permission: OrgPermission,
): void {
  if (!canInOrg(membership.role, permission)) {
    throw new ForbiddenError();
  }

  if (membership.role === "organization_owner") return;

  if (membership.role === "team_admin" && membership.teamId?.toString() === teamId) {
    return;
  }

  throw new ForbiddenError("You do not manage this team.");
}
