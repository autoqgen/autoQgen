import { Types } from "mongoose";

import { OrganizationInvitation, type IOrganizationInvitation } from "@/models";
import type { OrgRole } from "@/types/organization";

export const organizationInvitationRepository = {
  async create(input: {
    organizationId: string | Types.ObjectId;
    email: string;
    role: OrgRole;
    teamId: Types.ObjectId | null;
    invitedBy: Types.ObjectId;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<IOrganizationInvitation> {
    return OrganizationInvitation.create(input);
  },

  async findById(id: string | Types.ObjectId): Promise<IOrganizationInvitation | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return OrganizationInvitation.findById(id).exec();
  },

  async findByTokenHash(tokenHash: string): Promise<IOrganizationInvitation | null> {
    return OrganizationInvitation.findOne({ tokenHash }).exec();
  },

  async findPendingByOrgAndEmail(
    organizationId: string | Types.ObjectId,
    email: string,
  ): Promise<IOrganizationInvitation | null> {
    return OrganizationInvitation.findOne({
      organizationId,
      email: email.toLowerCase(),
      status: "pending",
    }).exec();
  },

  async listForOrg(options: {
    organizationId: string | Types.ObjectId;
    skip: number;
    limit: number;
  }): Promise<{ items: IOrganizationInvitation[]; total: number }> {
    const filter = { organizationId: options.organizationId };
    const [items, total] = await Promise.all([
      OrganizationInvitation.find(filter)
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit)
        .lean()
        .exec(),
      OrganizationInvitation.countDocuments(filter).exec(),
    ]);
    return { items, total };
  },

  async listPendingForEmail(email: string): Promise<IOrganizationInvitation[]> {
    return OrganizationInvitation.find({
      email: email.toLowerCase(),
      status: "pending",
      expiresAt: { $gt: new Date() },
    })
      .populate("organizationId", "name slug")
      .sort({ createdAt: -1 })
      .exec();
  },

  /** Atomic pending -> accepted. Returns false if another request already resolved it. */
  async markAccepted(id: string | Types.ObjectId): Promise<boolean> {
    const result = await OrganizationInvitation.updateOne(
      { _id: id, status: "pending" },
      { $set: { status: "accepted", acceptedAt: new Date() } },
    ).exec();
    return result.modifiedCount === 1;
  },

  /** Atomic pending -> rejected. */
  async markRejected(id: string | Types.ObjectId): Promise<boolean> {
    const result = await OrganizationInvitation.updateOne(
      { _id: id, status: "pending" },
      { $set: { status: "rejected", rejectedAt: new Date() } },
    ).exec();
    return result.modifiedCount === 1;
  },

  async markCancelled(id: string | Types.ObjectId): Promise<boolean> {
    const result = await OrganizationInvitation.updateOne(
      { _id: id, status: "pending" },
      { $set: { status: "cancelled" } },
    ).exec();
    return result.modifiedCount === 1;
  },

  async markExpired(id: string | Types.ObjectId): Promise<void> {
    await OrganizationInvitation.updateOne(
      { _id: id, status: "pending" },
      { $set: { status: "expired" } },
    ).exec();
  },
};

export type OrganizationInvitationRepository = typeof organizationInvitationRepository;
