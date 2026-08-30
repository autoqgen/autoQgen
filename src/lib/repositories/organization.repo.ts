import { Types } from "mongoose";

import { Organization, type IOrganization } from "@/models";

export const organizationRepository = {
  async findById(id: string | Types.ObjectId): Promise<IOrganization | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Organization.findById(id).exec();
  },

  /** Same lookup, with the owner's display fields populated for admin UI. */
  async findByIdWithOwner(id: string | Types.ObjectId): Promise<IOrganization | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Organization.findById(id).populate("owner", "name email").exec();
  },

  async findBySlug(slug: string): Promise<IOrganization | null> {
    return Organization.findOne({ slug: slug.toLowerCase() }).exec();
  },

  async existsBySlug(slug: string): Promise<boolean> {
    return Boolean(await Organization.exists({ slug: slug.toLowerCase() }).exec());
  },

  async list(options: {
    filter: Record<string, unknown>;
    skip: number;
    limit: number;
  }): Promise<{ items: IOrganization[]; total: number }> {
    const [items, total] = await Promise.all([
      Organization.find(options.filter)
        .populate("owner", "name email")
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit)
        .lean()
        .exec(),
      Organization.countDocuments(options.filter).exec(),
    ]);
    return { items, total };
  },

  async create(input: { name: string; slug: string; createdBy: Types.ObjectId }): Promise<IOrganization> {
    return Organization.create(input);
  },

  async update(
    id: string | Types.ObjectId,
    patch: Partial<Pick<IOrganization, "name" | "slug" | "isActive">>,
  ): Promise<IOrganization | null> {
    return Organization.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec();
  },

  async setOwner(
    id: string | Types.ObjectId,
    ownerId: string | Types.ObjectId,
  ): Promise<IOrganization | null> {
    return Organization.findByIdAndUpdate(id, { $set: { owner: ownerId } }, { new: true }).exec();
  },

  /** Clears the owner of a single organization (leaves the membership row alone). */
  async clearOwner(id: string | Types.ObjectId): Promise<void> {
    await Organization.updateOne({ _id: id }, { $set: { owner: null } }).exec();
  },

  /**
   * Clears this user as `owner` of every organization except `keepOrganizationId`
   * (pass `null` to clear them from every organization). Used to keep the
   * "one organization per user" invariant intact when an admin moves an owner
   * into a different organization — the org they used to own is simply left
   * ownerless for a Super Admin to reassign.
   */
  async vacateOwnershipExcept(
    userId: string | Types.ObjectId,
    keepOrganizationId: string | Types.ObjectId | null,
  ): Promise<void> {
    const filter: Record<string, unknown> = { owner: userId };
    if (keepOrganizationId) filter._id = { $ne: keepOrganizationId };
    await Organization.updateMany(filter, { $set: { owner: null } }).exec();
  },
};

export type OrganizationRepository = typeof organizationRepository;
