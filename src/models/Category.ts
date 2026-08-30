import { Schema, Types, model, models, type Model } from "mongoose";

export interface ICategory {
  _id: Types.ObjectId;
  /** The organization that owns this category. Academic content is tenant-isolated. */
  organizationId: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  order: number;
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 2000 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// Uniqueness and every list query are scoped to the owning organization.
CategorySchema.index({ organizationId: 1, slug: 1 }, { unique: true });
CategorySchema.index({ organizationId: 1, name: 1 }, { unique: true });
CategorySchema.index({ organizationId: 1, isActive: 1, order: 1, name: 1 });

export const Category: Model<ICategory> =
  (models.Category as Model<ICategory>) ?? model<ICategory>("Category", CategorySchema);

export default Category;
