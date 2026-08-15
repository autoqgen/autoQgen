import { Schema, Types, model, models, type Model } from "mongoose";

export interface ISubject {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  code: string;
  category: Types.ObjectId;
  classLevel: string;
  group: string;
  order: number;
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    code: { type: String, default: "", trim: true, maxlength: 40 },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    classLevel: { type: String, default: "", maxlength: 80 },
    group: { type: String, default: "", maxlength: 80 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

/**
 * Uniqueness is scoped to the parent category.
 *
 * The previous project declared `slug` globally unique while its route checked
 * for duplicates per category, so two categories could never both contain a
 * "physics" subject and the mismatch surfaced as an unhandled E11000 → HTTP 500.
 */
SubjectSchema.index({ category: 1, slug: 1 }, { unique: true });
SubjectSchema.index({ category: 1, name: 1 }, { unique: true });
SubjectSchema.index({ isActive: 1, category: 1, order: 1 });

export const Subject: Model<ISubject> =
  (models.Subject as Model<ISubject>) ?? model<ISubject>("Subject", SubjectSchema);

export default Subject;
