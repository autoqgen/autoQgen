import { Schema, Types, model, models, type Model } from "mongoose";

export interface ITeam {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  name: string;
  description: string;
  createdBy: Types.ObjectId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TeamSchema = new Schema<ITeam>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: "", trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

// Team names only need to be unique within their own organization.
TeamSchema.index({ organizationId: 1, name: 1 }, { unique: true });

export const Team: Model<ITeam> = (models.Team as Model<ITeam>) ?? model<ITeam>("Team", TeamSchema);

export default Team;
