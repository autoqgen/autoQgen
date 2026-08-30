import { Types } from "mongoose";

import { OrganizationMember, type IOrganizationMember } from "@/models";
import type { OrgMemberStatus, OrgRole } from "@/types/organization";

export const organizationMemberRepository = {
  async findActive(
    userId: string | Types.ObjectId,
    organizationId: string | Types.ObjectId,
  ): Promise<IOrganizationMember | null> {
    if (!Types.ObjectId.isValid(organizationId)) return null;
    return OrganizationMember.findOne({ userId, organizationId, status: "active" }).exec();
  },

  /** Includes suspended memberships — used when re-inviting or reactivating. */
  async findAnyForUserOrg(
    userId: string | Types.ObjectId,
    organizationId: string | Types.ObjectId,
  ): Promise<IOrganizationMember | null> {
    return OrganizationMember.findOne({ userId, organizationId }).exec();
  },

  async findById(id: string | Types.ObjectId): Promise<IOrganizationMember | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return OrganizationMember.findById(id).exec();
  },

  async listForOrg(options: {
    organizationId: string | Types.ObjectId;
    role?: OrgRole;
    skip: number;
    limit: number;
  }): Promise<{ items: IOrganizationMember[]; total: number }> {
    const filter: Record<string, unknown> = { organizationId: options.organizationId };
    if (options.role) filter.role = options.role;

    const [items, total] = await Promise.all([
      OrganizationMember.find(filter)
        .populate("userId", "name email image status")
        .populate("teamId", "name")
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit)
        .exec(),
      OrganizationMember.countDocuments(filter).exec(),
    ]);
    return { items, total };
  },

  async countForOrg(organizationId: string | Types.ObjectId): Promise<number> {
    return OrganizationMember.countDocuments({ organizationId, status: "active" }).exec();
  },

  async firstActiveForUser(userId: string | Types.ObjectId): Promise<IOrganizationMember | null> {
    return OrganizationMember.findOne({ userId, status: "active" }).sort({ createdAt: 1 }).exec();
  },

  async listActiveForUser(userId: string | Types.ObjectId): Promise<IOrganizationMember[]> {
    return OrganizationMember.find({ userId, status: "active" })
      .populate("organizationId", "name slug isActive")
      .sort({ createdAt: 1 })
      .exec();
  },

  /** Creates the membership if absent, or reactivates/re-roles it if present. */
  async upsertRole(input: {
    userId: string | Types.ObjectId;
    organizationId: string | Types.ObjectId;
    role: OrgRole;
    teamId?: Types.ObjectId | null;
    invitedBy?: Types.ObjectId | null;
  }): Promise<IOrganizationMember> {
    return OrganizationMember.findOneAndUpdate(
      { userId: input.userId, organizationId: input.organizationId },
      {
        $set: {
          role: input.role,
          status: "active",
          teamId: input.teamId ?? null,
          invitedBy: input.invitedBy ?? null,
        },
        $setOnInsert: { joinedAt: new Date() },
      },
      { upsert: true, new: true },
    ).exec();
  },

  async setRole(
    userId: string | Types.ObjectId,
    organizationId: string | Types.ObjectId,
    role: OrgRole,
  ): Promise<void> {
    await OrganizationMember.updateOne({ userId, organizationId }, { $set: { role } }).exec();
  },

  async updateFields(
    id: string | Types.ObjectId,
    patch: Partial<{ role: OrgRole; status: OrgMemberStatus; teamId: Types.ObjectId | null }>,
  ): Promise<IOrganizationMember | null> {
    return OrganizationMember.findByIdAndUpdate(id, { $set: patch }, { new: true })
      .populate("userId", "name email image status")
      .populate("teamId", "name")
      .exec();
  },

  async remove(id: string | Types.ObjectId): Promise<void> {
    await OrganizationMember.deleteOne({ _id: id }).exec();
  },

  /**
   * Enforces "one organization per user": drops every membership this user
   * holds outside `keepOrganizationId`. A no-op when they only belong to that
   * one organization already.
   */
  async removeOtherMemberships(
    userId: string | Types.ObjectId,
    keepOrganizationId: string | Types.ObjectId,
  ): Promise<void> {
    await OrganizationMember.deleteMany({
      userId,
      organizationId: { $ne: keepOrganizationId },
    }).exec();
  },

  /** Drops every membership for a user — used when clearing their organization entirely. */
  async removeAllForUser(userId: string | Types.ObjectId): Promise<void> {
    await OrganizationMember.deleteMany({ userId }).exec();
  },

  /** Clears a now-deleted/deactivated team from any member still pointing at it. */
  async clearTeamForMembers(teamId: string | Types.ObjectId): Promise<void> {
    await OrganizationMember.updateMany({ teamId }, { $set: { teamId: null } }).exec();
  },
};

export type OrganizationMemberRepository = typeof organizationMemberRepository;
