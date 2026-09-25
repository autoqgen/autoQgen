import { Schema, Types, model, models, type Model } from "mongoose";

import { DIFFICULTIES, QUESTION_STATUSES, type Difficulty, type QuestionStatus } from "@/types/question";

export interface ICreativeQuestionPart {
  sourceQuestion: Types.ObjectId | null;
  text: string;
  answer: string;
  marks: 1 | 2 | 3 | 4;
  order: 0 | 1 | 2 | 3;
}

const CreativeQuestionPartSchema = new Schema<ICreativeQuestionPart>(
  {
    sourceQuestion: { type: Schema.Types.ObjectId, ref: "Question", default: null },
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    answer: { type: String, required: true, trim: true, maxlength: 10000 },
    marks: { type: Number, enum: [1, 2, 3, 4], required: true },
    order: { type: Number, enum: [0, 1, 2, 3], required: true },
  },
  { _id: false },
);

export interface ICreativeQuestion {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  topic: Types.ObjectId | null;
  difficulty: Difficulty | null;
  instruction: string;
  stimulus: string;
  questions: ICreativeQuestionPart[];
  totalMarks: 10;
  status: QuestionStatus;
  isActive: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CreativeQuestionSchema = new Schema<ICreativeQuestion>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    chapter: { type: Schema.Types.ObjectId, ref: "Chapter", required: true },
    topic: { type: Schema.Types.ObjectId, ref: "Topic", default: null },
    difficulty: { type: String, enum: [...DIFFICULTIES, null], default: null },
    instruction: { type: String, default: "", maxlength: 5000 },
    stimulus: { type: String, required: true, trim: true, maxlength: 20000 },
    questions: { type: [CreativeQuestionPartSchema], required: true, validate: (parts: unknown[]) => parts.length === 4 },
    totalMarks: { type: Number, enum: [10], default: 10 },
    status: { type: String, enum: QUESTION_STATUSES, default: "DRAFT" },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

CreativeQuestionSchema.index({ organizationId: 1, isActive: 1, status: 1, subject: 1, createdAt: -1 });
CreativeQuestionSchema.index({ organizationId: 1, chapter: 1, createdAt: -1 });

export const CreativeQuestion: Model<ICreativeQuestion> =
  (models.CreativeQuestion as Model<ICreativeQuestion>) ??
  model<ICreativeQuestion>("CreativeQuestion", CreativeQuestionSchema);
