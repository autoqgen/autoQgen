import { Types } from "mongoose";

import { organizationMemberRepository } from "@/lib/repositories/organization-member.repo";
import { organizationRepository } from "@/lib/repositories/organization.repo";
import { organizationService } from "@/lib/services/organization.service";
import { userRepository } from "@/lib/repositories/user.repo";
import { ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import type { AuthContext } from "@/lib/auth/session";
import { toSkip } from "@/lib/validation/common";
import type { MemberListQuery, UpdateMemberInput } from "@/lib/validation/organization.schema";
import type { OrgRole } from "@/types/organization";
import type { IOrganizationMember } from "@/models";

/**
 * A ref field after `.populate()` — Mongoose's static types don't reflect the
 * runtime shape, so populated docs are read defensively via this narrow view.
 */
interface PopulatedRef {
  _id: Types.ObjectId;
  name?: string;
  email?: string;
  image?: string;
  status?: string;
}

function asPopulated(value: unknown): PopulatedRef | null {
  if (value && typeof value === "object" && "_id" in value) return value as PopulatedRef;
  return null;
}

function serializeMember(member: IOrganizationMember) {
  const user = asPopulated(member.userId);
  const team = asPopulated(member.teamId);

  return {
    id: member._id.toString(),
    userId: user ? user._id.toString() : member.userId.toString(),
    name: user?.name ?? "",
    email: user?.email ?? "",
    image: user?.image ?? "",
    role: member.role,
    status: member.status,
    teamId: team ? team._id.toString() : member.teamId ? member.teamId.toString() : null,
    teamName: team?.name ?? null,
    joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
    createdAt: member.createdAt.toISOString(),
  };
}

export const organizationMemberService = {
  async list(organizationId: string, query: MemberListQuery) {
    const { items, total } = await organizationMemberRepository.listForOrg({
      organizationId,
      role: query.role,
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
    });

    let filtered = items;
    if (query.search) {
      const term = query.search.toLowerCase();
      filtered = items.filter((member) => {
        const user = asPopulated(member.userId);
        return (
          user?.name?.toLowerCase().includes(term) || user?.email?.toLowerCase().includes(term)
        );
      });
    }

    return { items: filtered.map(serializeMember), total };
  },

  async updateMember(
    organizationId: string,
    targetMemberId: string,
    patch: UpdateMemberInput,
    audit: AuditContext,
  ) {
    const target = await organizationMemberRepository.findById(targetMemberId);
    if (!target || target.organizationId.toString() !== organizationId) {
      throw new NotFoundError("Member");
    }

    // Owner changes are a Super Admin action (assign-owner), never a plain
    // member-role edit — this route only ever reaches organization_owner
    // actors (route-level `members:update` permission), so this guard is the
    // backstop against an owner accidentally demoting/relocating themselves.
    if (target.role === "organization_owner") {
      throw new ForbiddenError("Reassign the organization owner from Admin Center instead.");
    }

    const setPatch: Parameters<typeof organizationMemberRepository.updateFields>[1] = {};
    if (patch.role !== undefined) setPatch.role = patch.role;
    if (patch.status !== undefined) setPatch.status = patch.status;
    if (patch.teamId !== undefined) {
      setPatch.teamId = patch.teamId ? new Types.ObjectId(patch.teamId) : null;
    }

    const updated = await organizationMemberRepository.updateFields(targetMemberId, setPatch);

    await auditService.record(
      {
        action: "organization.member.update-role",
        resourceType: "organization_member",
        resourceId: targetMemberId,
        metadata: { organizationId, patch },
      },
      audit,
    );

    return serializeMember(updated!);
  },

  async removeMember(organizationId: string, targetMemberId: string, audit: AuditContext) {
    const target = await organizationMemberRepository.findById(targetMemberId);
    if (!target || target.organizationId.toString() !== organizationId) {
      throw new NotFoundError("Member");
    }
    if (target.role === "organization_owner") {
      throw new ForbiddenError("Cannot remove the organization owner. Reassign ownership first.");
    }

    await organizationMemberRepository.remove(targetMemberId);

    await auditService.record(
      {
        action: "organization.member.remove",
        resourceType: "organization_member",
        resourceId: targetMemberId,
        metadata: { organizationId, userId: target.userId.toString() },
      },
      audit,
    );
  },

  /** "My organizations" — used by the dashboard overview and org switcher. */
  async listMineWithOrganization(user: AuthContext) {
    const memberships = await organizationMemberRepository.listActiveForUser(user.objectId);
    return memberships.map((membership) => {
      const org = asPopulated(membership.organizationId);
      return {
        organizationId: org ? org._id.toString() : membership.organizationId.toString(),
        organizationName: (org as { name?: string } | null)?.name ?? "",
        organizationSlug: (org as { slug?: string } | null)?.slug ?? "",
        role: membership.role,
      };
    });
  },

  async switchCurrentOrganization(user: AuthContext, organizationId: string) {
    const membership = await organizationMemberRepository.findActive(user.objectId, organizationId);
    if (!membership) {
      // The platform administrator may act inside any tenant without joining
      // it (needed to manage an organization's academic content); everyone
      // else must be an active member of the target organization.
      if (user.role !== "super_admin") {
        throw new ForbiddenError("You are not a member of that organization.");
      }
      const organization = await organizationRepository.findById(organizationId);
      if (!organization) throw new NotFoundError("Organization");
    }
    await userRepository.setCurrentOrganization(user.objectId, organizationId);
    return { organizationId };
  },

  /**
   * Admin Center → Users & Roles: move a user into exactly one organization
   * (or clear it) and set their role *within that organization*. The global
   * `User.role` is never read or written here — it is an orthogonal concern.
   *
   * Upholds the "one organization at a time" invariant:
   *   - every membership outside the target org is deleted;
   *   - the user is vacated as `owner` of any other organization (that org is
   *     simply left ownerless for a Super Admin to reassign);
   *   - `User.organization` — the context pointer every org-scoped route
   *     resolves through — is switched to the target org.
   *
   * When the org role is `organization_owner`, the full Super-Admin owner
   * assignment runs for the target org (sets `Organization.owner`, demotes the
   * previous owner to `team_admin`), so invitations, teams, settings, chat and
   * org-specific data all work for that organization with no special-casing.
   *
   * `input.organizationId`:
   *   - a real id   → assign / move the user into that organization
   *   - `null`      → remove the user from every organization
   *   - `undefined` → keep their current organization, only change the org role
   */
  async setUserOrganization(
    target: { userId: Types.ObjectId; currentOrganizationId: string | null },
    input: { organizationId?: string | null; role?: OrgRole },
    actor: AuthContext,
    audit: AuditContext,
  ): Promise<{ organizationId: string | null; organizationRole: OrgRole | null }> {
    const { userId } = target;

    if (input.organizationId === undefined && input.role !== undefined && !target.currentOrganizationId) {
      throw new ValidationError(
        "Assign the user to an organization before setting an organization role.",
      );
    }

    const targetOrganizationId =
      input.organizationId !== undefined ? input.organizationId : target.currentOrganizationId;

    // Remove the user from every organization.
    if (targetOrganizationId === null) {
      await organizationRepository.vacateOwnershipExcept(userId, null);
      await organizationMemberRepository.removeAllForUser(userId);
      await userRepository.setCurrentOrganization(userId, null);
      return { organizationId: null, organizationRole: null };
    }

    const org = await organizationRepository.findById(targetOrganizationId);
    if (!org) throw new ValidationError("Selected organization does not exist.");

    // One organization at a time: drop any other membership / foreign ownership.
    await organizationRepository.vacateOwnershipExcept(userId, org._id);
    await organizationMemberRepository.removeOtherMemberships(userId, org._id);

    const existing = await organizationMemberRepository.findAnyForUserOrg(userId, org._id);
    const desiredRole: OrgRole = input.role ?? existing?.role ?? "member";

    if (desiredRole === "organization_owner") {
      // Reuse the Super-Admin owner-assignment path so ownership bookkeeping
      // (Organization.owner, previous-owner demotion, membership upsert) lives
      // in exactly one place.
      await organizationService.assignOwner(
        org._id.toString(),
        { userId: userId.toString() },
        actor,
        audit,
      );
    } else {
      if (org.owner && org.owner.toString() === userId.toString()) {
        // They owned this very organization but are being set to a lesser role.
        await organizationRepository.clearOwner(org._id);
      }
      await organizationMemberRepository.upsertRole({
        userId,
        organizationId: org._id,
        role: desiredRole,
        invitedBy: actor.objectId,
      });
    }

    await userRepository.setCurrentOrganization(userId, org._id);

    return { organizationId: org._id.toString(), organizationRole: desiredRole };
  },
};

export { serializeMember };
