import { Schema, Types, model, models, type Model } from "mongoose";

export const EXAM_TYPES = ["SSC", "HSC", "ADMISSION", "BCS", "JOB", "OTHER"] as const;
export type ExamType = (typeof EXAM_TYPES)[number];

export interface IExam {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  type: ExamType;
  category: Types.ObjectId | null;
  board: Types.ObjectId | null;
  year: number | null;
  session: string;
  description: string;
  order: number;
  isActive: boolean;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ExamSchema = new Schema<IExam>(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    type: { type: String, enum: EXAM_TYPES, default: "OTHER", index: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", default: null, index: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", default: null, index: true },
    year: { type: Number, default: null, min: 1900, max: 2200 },
    session: { type: String, default: "", trim: true, maxlength: 80 },
    description: { type: String, default: "", maxlength: 2000 },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

/**
 * The previous key was (slug, year) with year defaulting to null, so two
 * distinct exams sharing a slug and lacking a year collided. Including board
 * makes the key describe the real business identity of an exam sitting.
 */
ExamSchema.index({ slug: 1, year: 1, board: 1 }, { unique: true });
ExamSchema.index({ isActive: 1, type: 1, year: -1 });

export const Exam: Model<IExam> = (models.Exam as Model<IExam>) ?? model<IExam>("Exam", ExamSchema);

export default Exam;
