import { Types } from "mongoose";

import { organizationRepository } from "@/lib/repositories/organization.repo";
import { organizationMemberRepository } from "@/lib/repositories/organization-member.repo";
import { userRepository } from "@/lib/repositories/user.repo";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import type { AuthContext } from "@/lib/auth/session";
import { toSkip } from "@/lib/validation/common";
import type {
  AssignOwnerInput,
  CreateOrganizationInput,
  OrganizationListQuery,
  UpdateOrganizationInput,
} from "@/lib/validation/organization.schema";
import type { IOrganization } from "@/models";

/**
 * Super Admin organization management. Every mutation is gated at the route
 * level behind the platform-level `organization:manage` permission (only
 * `super_admin` holds it, see rbac.ts) — this file assumes that check
 * already happened and focuses on business rules and data integrity.
 */

interface PopulatedOwner {
  _id: Types.ObjectId;
  name?: string;
  email?: string;
}

function asPopulatedOwner(value: unknown): PopulatedOwner | null {
  if (value && typeof value === "object" && "_id" in value) return value as PopulatedOwner;
  return null;
}

function serializeOrganization(org: IOrganization) {
  const owner = asPopulatedOwner(org.owner);
  return {
    id: org._id.toString(),
    name: org.name,
    slug: org.slug,
    ownerId: owner ? owner._id.toString() : org.owner ? org.owner.toString() : null,
    ownerName: owner?.name ?? null,
    ownerEmail: owner?.email ?? null,
    isActive: org.isActive,
    createdBy: org.createdBy ? org.createdBy.toString() : null,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export const organizationService = {
  async list(query: OrganizationListQuery) {
    const filter: Record<string, unknown> = {};
    if (query.isActive !== undefined) filter.isActive = query.isActive;
    if (query.search) {
      const term = query.search.trim();
      filter.$or = [
        { name: { $regex: term, $options: "i" } },
        { slug: { $regex: term, $options: "i" } },
      ];
    }

    const { items, total } = await organizationRepository.list({
      filter,
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
    });

    const withCounts = await Promise.all(
      items.map(async (org) => ({
        ...serializeOrganization(org),
        memberCount: await organizationMemberRepository.countForOrg(org._id),
      })),
    );

    return { items: withCounts, total };
  },

  async getById(id: string) {
    const org = await organizationRepository.findByIdWithOwner(id);
    if (!org) throw new NotFoundError("Organization");
    const memberCount = await organizationMemberRepository.countForOrg(org._id);
    return { ...serializeOrganization(org), memberCount };
  },

  async create(input: CreateOrganizationInput, actor: AuthContext, audit: AuditContext) {
    if (await organizationRepository.existsBySlug(input.slug)) {
      throw new ConflictError("An organization with this slug already exists.");
    }

    const org = await organizationRepository.create({
      name: input.name,
      slug: input.slug,
      createdBy: actor.objectId,
    });

    await auditService.record(
      {
        action: "organization.create",
        resourceType: "organization",
        resourceId: org._id.toString(),
        metadata: { name: org.name, slug: org.slug },
      },
      audit,
    );

    return serializeOrganization(org);
  },

  async update(id: string, input: UpdateOrganizationInput, audit: AuditContext) {
    const org = await organizationRepository.findById(id);
    if (!org) throw new NotFoundError("Organization");

    if (input.slug && input.slug !== org.slug && (await organizationRepository.existsBySlug(input.slug))) {
      throw new ConflictError("An organization with this slug already exists.");
    }

    const updated = await organizationRepository.update(id, input);

    await auditService.record(
      {
        action: "organization.update",
        resourceType: "organization",
        resourceId: id,
        metadata: { changes: input },
      },
      audit,
    );

    return serializeOrganization(updated!);
  },

  async assignOwner(
    organizationId: string,
    input: AssignOwnerInput,
    actor: AuthContext,
    audit: AuditContext,
  ) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new NotFoundError("Organization");

    const newOwner = await userRepository.findPublicById(input.userId);
    if (!newOwner) throw new ValidationError("Selected user does not exist.");
    if (newOwner.status !== "active") {
      throw new ValidationError("Selected user must be active to become an organization owner.");
    }

    const previousOwnerId = org.owner ? org.owner.toString() : null;

    if (previousOwnerId && previousOwnerId !== input.userId) {
      // Prevent two live "organization_owner" memberships after a change —
      // the outgoing owner keeps their membership, just demoted to team_admin
      // (an adjustable default; they are not removed from the organization).
      await organizationMemberRepository.setRole(previousOwnerId, organizationId, "team_admin");
    }

    await organizationMemberRepository.upsertRole({
      userId: input.userId,
      organizationId,
      role: "organization_owner",
      invitedBy: actor.objectId,
    });

    const updated = await organizationRepository.setOwner(organizationId, input.userId);

    await auditService.record(
      {
        action: "organization.assign-owner",
        resourceType: "organization",
        resourceId: organizationId,
        metadata: { previousOwnerId, newOwnerId: input.userId, newOwnerEmail: newOwner.email },
      },
      audit,
    );

    return serializeOrganization(updated!);
  },
};
