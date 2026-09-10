import { Schema, Types, model, models, type Model } from "mongoose";

/**
 * A reusable question-paper pattern, owned by an organization.
 *
 * Bundles BOTH a question-generation pattern and a Paper Design configuration so
 * a standard paper can be defined once and loaded as a starting point whenever a
 * paper is created. The two config blobs are stored verbatim (`Mixed`) and
 * validated on write by the same Zod schemas the paper stack already uses
 * (`templateGenerationSpecSchema` / `paperDesignSchema`) — a template is never
 * mutated by a user's paper-specific edits; the New Paper builder copies these
 * values into its own local state.
 */

export interface IQuestionPatternTemplate {
  _id: Types.ObjectId;

  /** The organization that owns this template. Matches its taxonomy/papers. */
  organizationId: Types.ObjectId;

  name: string;
  description: string;

  /** Denormalised from `generationSpec` for list display / filtering. Optional. */
  category: Types.ObjectId | null;
  subject: Types.ObjectId | null;

  /** Question-generation pattern — see `templateGenerationSpecSchema`. */
  generationSpec: Record<string, unknown>;
  /** Paper appearance / output configuration — see `paperDesignSchema`. */
  designConfig: Record<string, unknown>;

  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId | null;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionPatternTemplateSchema = new Schema<IQuestionPatternTemplate>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },

    category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", default: null },

    generationSpec: { type: Schema.Types.Mixed, default: {} },
    designConfig: { type: Schema.Types.Mixed, default: {} },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Uniqueness and every list query are scoped to the owning organization.
QuestionPatternTemplateSchema.index({ organizationId: 1, name: 1 }, { unique: true });
QuestionPatternTemplateSchema.index({ organizationId: 1, isActive: 1, updatedAt: -1 });

export const QuestionPatternTemplate: Model<IQuestionPatternTemplate> =
  (models.QuestionPatternTemplate as Model<IQuestionPatternTemplate>) ??
  model<IQuestionPatternTemplate>("QuestionPatternTemplate", QuestionPatternTemplateSchema);

export default QuestionPatternTemplate;
