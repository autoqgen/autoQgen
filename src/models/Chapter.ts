import { Schema, Types, model, models, type Model } from "mongoose";

export interface IChapter {
  _id: Types.ObjectId;
  /** The organization that owns this chapter. Matches the parent subject's organization. */
  organizationId: Types.ObjectId;
  name: string;
  slug: string;
  chapterNo: number;
  description: string;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  order: number;
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ChapterSchema = new Schema<IChapter>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    chapterNo: { type: Number, default: 0, min: 0 },
    description: { type: String, default: "", maxlength: 2000 },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

ChapterSchema.index({ organizationId: 1, subject: 1, slug: 1 }, { unique: true });
ChapterSchema.index({ organizationId: 1, isActive: 1, subject: 1, order: 1 });

export const Chapter: Model<IChapter> =
  (models.Chapter as Model<IChapter>) ?? model<IChapter>("Chapter", ChapterSchema);

export default Chapter;
