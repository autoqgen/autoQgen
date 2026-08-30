import { Schema, Types, model, models, type Model } from "mongoose";

export interface ISubject {
  _id: Types.ObjectId;
  /** The organization that owns this subject. Matches the parent category's organization. */
  organizationId: Types.ObjectId;
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
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    code: { type: String, default: "", trim: true, maxlength: 40 },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    classLevel: { type: String, default: "", maxlength: 80 },
    group: { type: String, default: "", maxlength: 80 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

/**
 * Uniqueness is scoped to the parent category, which is itself organization-
 * scoped; `organizationId` is carried in the key so it prefixes every
 * tenant-filtered list query as well.
 */
SubjectSchema.index({ organizationId: 1, category: 1, slug: 1 }, { unique: true });
SubjectSchema.index({ organizationId: 1, category: 1, name: 1 }, { unique: true });
SubjectSchema.index({ organizationId: 1, isActive: 1, category: 1, order: 1 });

export const Subject: Model<ISubject> =
  (models.Subject as Model<ISubject>) ?? model<ISubject>("Subject", SubjectSchema);

export default Subject;
