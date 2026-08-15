import { Schema, Types, model, models, type Model } from "mongoose";

export interface ITopic {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  order: number;
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TopicSchema = new Schema<ITopic>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true, index: true },
    chapter: { type: Schema.Types.ObjectId, ref: "Chapter", required: true, index: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

TopicSchema.index({ chapter: 1, slug: 1 }, { unique: true });
TopicSchema.index({ isActive: 1, chapter: 1, order: 1 });

export const Topic: Model<ITopic> =
  (models.Topic as Model<ITopic>) ?? model<ITopic>("Topic", TopicSchema);

export default Topic;
