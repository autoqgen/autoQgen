import { Types } from "mongoose";

import { Team, type ITeam } from "@/models";

export const teamRepository = {
  async findById(id: string | Types.ObjectId): Promise<ITeam | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return Team.findById(id).exec();
  },

  async existsByName(organizationId: string | Types.ObjectId, name: string): Promise<boolean> {
    return Boolean(await Team.exists({ organizationId, name }).exec());
  },

  async listForOrg(organizationId: string | Types.ObjectId): Promise<ITeam[]> {
    return Team.find({ organizationId }).sort({ name: 1 }).lean().exec();
  },

  async create(input: {
    organizationId: string | Types.ObjectId;
    name: string;
    description: string;
    createdBy: Types.ObjectId;
  }): Promise<ITeam> {
    return Team.create(input);
  },

  async update(
    id: string | Types.ObjectId,
    patch: Partial<Pick<ITeam, "name" | "description" | "isActive">>,
  ): Promise<ITeam | null> {
    return Team.findByIdAndUpdate(id, { $set: patch }, { new: true }).exec();
  },
};

export type TeamRepository = typeof teamRepository;
