import { Schema, Types, model, models, type Model } from "mongoose";

/**
 * Minimal Organization model.
 *
 * The previous project's User schema referenced "Organization" but no such
 * model existed, so any `.populate("organization")` threw MissingSchemaError at
 * runtime. The reference is kept because multi-tenancy is on the roadmap; the
 * model now actually exists. Full organization management is Step 3 scope.
 */

export interface IOrganization {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  owner: Types.ObjectId | null;
  isActive: boolean;
  /** The Super Admin who created this organization. Nullable for org rows that predate this field. */
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: 160,
    },
    owner: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

export const Organization: Model<IOrganization> =
  (models.Organization as Model<IOrganization>) ??
  model<IOrganization>("Organization", OrganizationSchema);

export default Organization;
