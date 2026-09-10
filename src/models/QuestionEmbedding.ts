import { Schema, Types, model, models, type Model } from "mongoose";

/**
 * Cached Gemini embedding for one question.
 *
 * Purely a cache for the per-paper semantic similarity check — it is never the
 * source of truth for a question and never read outside similarity code. A
 * question's text/options edit changes `sourceHash`, and an embedding-model
 * change changes `model`; either mismatch makes the row a cache miss and the
 * vector is regenerated. Organization-scoped like every other collection.
 */

export interface IQuestionEmbedding {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  questionId: Types.ObjectId;
  /** sha256 of the exact text that was embedded (question text + options + passage). */
  sourceHash: string;
  /** The Gemini embedding model that produced `vector`. */
  model: string;
  vector: number[];
  dims: number;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionEmbeddingSchema = new Schema<IQuestionEmbedding>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    questionId: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    sourceHash: { type: String, required: true, maxlength: 64 },
    model: { type: String, required: true, maxlength: 120 },
    vector: { type: [Number], required: true },
    dims: { type: Number, required: true },
  },
  { timestamps: true },
);

// One cached embedding per question; scoped for tenant isolation on reads.
QuestionEmbeddingSchema.index({ organizationId: 1, questionId: 1 }, { unique: true });

export const QuestionEmbedding: Model<IQuestionEmbedding> =
  (models.QuestionEmbedding as Model<IQuestionEmbedding>) ??
  model<IQuestionEmbedding>("QuestionEmbedding", QuestionEmbeddingSchema);

export default QuestionEmbedding;
