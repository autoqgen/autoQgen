import { Schema, Types, model, models, type Model } from "mongoose";

/**
 * A record that a question was placed on a generated question paper.
 *
 * Organization-scoped like every other content model: usage is only ever read
 * or written for the paper's own organization, so one tenant's history can
 * never influence another's generation. Written when a paper is successfully
 * generated and saved (see `questionUsageService.recordForPaper`).
 */

export const PAPER_TYPES = [
  "MODEL_TEST",
  "EXAM",
  "PRACTICE_TEST",
  "ASSIGNMENT",
  "OTHER",
] as const;
export type PaperType = (typeof PAPER_TYPES)[number];

export interface IQuestionUsage {
  _id: Types.ObjectId;
  questionId: Types.ObjectId;
  organizationId: Types.ObjectId;
  questionPaperId: Types.ObjectId;
  paperType: PaperType;
  usedAt: Date;
  createdBy: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionUsageSchema = new Schema<IQuestionUsage>(
  {
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    questionPaperId: { type: Schema.Types.ObjectId, ref: "QuestionPaper", required: true },
    paperType: { type: String, enum: PAPER_TYPES, default: "OTHER", required: true },
    usedAt: { type: Date, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

// "Has this question been used, how often, when last?" for one organization.
QuestionUsageSchema.index({ organizationId: 1, questionId: 1, usedAt: -1 });
// "The organization's most recent papers" and "questions used in these papers".
QuestionUsageSchema.index({ organizationId: 1, usedAt: -1 });
QuestionUsageSchema.index({ organizationId: 1, questionPaperId: 1 });
// One row per (question, paper) — re-recording the same paper is idempotent.
QuestionUsageSchema.index({ questionId: 1, questionPaperId: 1 }, { unique: true });

export const QuestionUsage: Model<IQuestionUsage> =
  (models.QuestionUsage as Model<IQuestionUsage>) ??
  model<IQuestionUsage>("QuestionUsage", QuestionUsageSchema);

export default QuestionUsage;
