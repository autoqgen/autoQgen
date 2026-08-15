import { Schema, Types, model, models, type Model } from "mongoose";

export interface ICategory {
  _id: Types.ObjectId;
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
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    description: { type: String, default: "", maxlength: 2000 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

CategorySchema.index({ slug: 1 }, { unique: true });
CategorySchema.index({ name: 1 }, { unique: true });
CategorySchema.index({ isActive: 1, order: 1, name: 1 });

export const Category: Model<ICategory> =
  (models.Category as Model<ICategory>) ?? model<ICategory>("Category", CategorySchema);

export default Category;
