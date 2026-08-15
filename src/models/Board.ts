import { Schema, Types, model, models, type Model } from "mongoose";

export interface IBoard {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  shortName: string;
  country: string;
  order: number;
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const BoardSchema = new Schema<IBoard>(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 160 },
    shortName: { type: String, default: "", trim: true, maxlength: 40 },
    country: { type: String, default: "Bangladesh", trim: true, maxlength: 80 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

BoardSchema.index({ slug: 1 }, { unique: true });
BoardSchema.index({ name: 1 }, { unique: true });
BoardSchema.index({ isActive: 1, order: 1, name: 1 });

export const Board: Model<IBoard> =
  (models.Board as Model<IBoard>) ?? model<IBoard>("Board", BoardSchema);

export default Board;
