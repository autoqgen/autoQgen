import { Schema, Types, model, models, type Model } from "mongoose";

import { PAPER_MODES, PAPER_STATUSES, type PaperMode, type PaperStatus } from "@/types/paper";
import { DIFFICULTIES, LANGUAGES, QUESTION_TYPES } from "@/types/question";

/**
 * A generated or hand-built question paper.
 *
 * Design notes:
 * - Questions are stored as references plus a *snapshot* of the marks and order
 *   used at build time. The reference keeps the paper in step with content
 *   corrections; the snapshot keeps the mark total stable even if a question's
 *   default marks are later edited.
 * - Sections are supported but optional; a paper with no sections renders as a
 *   single flat list.
 */

export interface IPaperQuestion {
  question: Types.ObjectId;
  /** Position within the section (0-based). */
  order: number;
  /** Marks as applied on this paper, snapshotted at insertion time. */
  marks: number;
  /** Optional per-paper override, e.g. "Answer any two". */
  note: string;
}

const PaperQuestionSchema = new Schema<IPaperQuestion>(
  {
    question: { type: Schema.Types.ObjectId, ref: "Question", required: true },
    order: { type: Number, required: true, min: 0 },
    marks: { type: Number, required: true, min: 0, max: 1000 },
    note: { type: String, default: "", maxlength: 500 },
  },
  { _id: false },
);

export interface IPaperSection {
  title: string;
  instructions: string;
  order: number;
  questions: IPaperQuestion[];
}

const PaperSectionSchema = new Schema<IPaperSection>(
  {
    title: { type: String, default: "", trim: true, maxlength: 200 },
    instructions: { type: String, default: "", maxlength: 2000 },
    order: { type: Number, required: true, min: 0 },
    questions: { type: [PaperQuestionSchema], default: [] },
  },
  { _id: false },
);

export interface IDifficultyQuota {
  difficulty: string;
  count: number;
}

export interface ITypeQuota {
  type: string;
  count: number;
}

export interface IChapterQuota {
  chapter: Types.ObjectId;
  count: number;
}

/**
 * The COMPLETE smart-generation configuration an AUTO paper was generated from.
 * Persisted verbatim so the Paper View page can display it and a regeneration
 * can start from the exact same settings. Category / subject / organization are
 * server-resolved at generation time and stored here for reference only.
 */
export interface IGenerationSpec {
  category: Types.ObjectId | null;
  subject: Types.ObjectId | null;
  board: Types.ObjectId | null;
  exam: Types.ObjectId | null;
  year: number | null;
  language: string | null;
  chapters: Types.ObjectId[];
  topics: Types.ObjectId[];
  totalQuestions: number;
  totalMarks: number | null;
  difficultyDistribution: IDifficultyQuota[];
  typeDistribution: ITypeQuota[];
  chapterDistribution: IChapterQuota[];
  previousQuestions: { mode: string; percent: number; paperRange: number };
  excludeRecentPapers: number;
  mandatoryQuestionIds: Types.ObjectId[];
  excludedQuestionIds: Types.ObjectId[];
  randomize: { selection: boolean; order: boolean; options: boolean };
  /** Seed recorded so a generation can be reproduced for debugging. */
  seed: string;
}

const GenerationSpecSchema = new Schema<IGenerationSpec>(
  {
    category: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", default: null },
    board: { type: Schema.Types.ObjectId, ref: "Board", default: null },
    exam: { type: Schema.Types.ObjectId, ref: "Exam", default: null },
    year: { type: Number, default: null, min: 1900, max: 2200 },
    language: { type: String, enum: [...LANGUAGES, null], default: null },
    chapters: { type: [Schema.Types.ObjectId], ref: "Chapter", default: [] },
    topics: { type: [Schema.Types.ObjectId], ref: "Topic", default: [] },
    totalQuestions: { type: Number, default: 0, min: 0, max: 500 },
    totalMarks: { type: Number, default: null, min: 0, max: 10000 },
    difficultyDistribution: {
      type: [
        new Schema<IDifficultyQuota>(
          {
            difficulty: { type: String, enum: DIFFICULTIES },
            count: { type: Number, min: 0, max: 500 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    typeDistribution: {
      type: [
        new Schema<ITypeQuota>(
          {
            type: { type: String, enum: QUESTION_TYPES },
            count: { type: Number, min: 0, max: 500 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    chapterDistribution: {
      type: [
        new Schema<IChapterQuota>(
          {
            chapter: { type: Schema.Types.ObjectId, ref: "Chapter" },
            count: { type: Number, min: 0, max: 500 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    previousQuestions: {
      type: new Schema(
        {
          mode: { type: String, enum: ["exclude", "allow", "prefer"], default: "allow" },
          percent: { type: Number, min: 0, max: 100, default: 100 },
          paperRange: { type: Number, min: 0, max: 100, default: 0 },
        },
        { _id: false },
      ),
      default: () => ({ mode: "allow", percent: 100, paperRange: 0 }),
    },
    excludeRecentPapers: { type: Number, min: 0, max: 50, default: 0 },
    mandatoryQuestionIds: { type: [Schema.Types.ObjectId], ref: "Question", default: [] },
    excludedQuestionIds: { type: [Schema.Types.ObjectId], ref: "Question", default: [] },
    randomize: {
      type: new Schema(
        {
          selection: { type: Boolean, default: true },
          order: { type: Boolean, default: false },
          options: { type: Boolean, default: false },
        },
        { _id: false },
      ),
      default: () => ({ selection: true, order: false, options: false }),
    },
    seed: { type: String, default: "", maxlength: 64 },
  },
  { _id: false },
);

export interface IQuestionPaper {
  _id: Types.ObjectId;

  /** The organization that owns this paper. Matches its taxonomy/questions. */
  organizationId: Types.ObjectId;

  title: string;
  description: string;
  instructions: string;

  category: Types.ObjectId;
  subject: Types.ObjectId;
  board: Types.ObjectId | null;
  exam: Types.ObjectId | null;
  year: number | null;

  mode: PaperMode;
  status: PaperStatus;

  durationMinutes: number | null;
  /** Denormalised from the sections on every write; never client-supplied. */
  totalMarks: number;
  totalQuestions: number;

  sections: IPaperSection[];
  generationSpec: IGenerationSpec | null;
  /**
   * Paper appearance / output configuration, edited from the Design sidebar.
   * A structured but renderer-forward blob: "Save Design" persists it here
   * without regenerating questions. The export renderer consumes the subset it
   * currently supports and ignores the rest.
   */
  designConfig: Record<string, unknown> | null;

  /** Provenance for the Clone action; not a versioning mechanism. */
  clonedFrom: Types.ObjectId | null;

  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId | null;
  publishedBy: Types.ObjectId | null;
  publishedAt: Date | null;
  archivedAt: Date | null;

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const QuestionPaperSchema = new Schema<IQuestionPaper>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },
    instructions: { type: String, default: "", maxlength: 5000 },

    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    board: { type: Schema.Types.ObjectId, ref: "Board", default: null },
    exam: { type: Schema.Types.ObjectId, ref: "Exam", default: null },
    year: { type: Number, default: null, min: 1900, max: 2200 },

    mode: { type: String, enum: PAPER_MODES, default: "MANUAL" },
    status: { type: String, enum: PAPER_STATUSES, default: "DRAFT" },

    durationMinutes: { type: Number, default: null, min: 0, max: 1440 },
    totalMarks: { type: Number, default: 0, min: 0 },
    totalQuestions: { type: Number, default: 0, min: 0 },

    sections: { type: [PaperSectionSchema], default: [] },
    generationSpec: { type: GenerationSpecSchema, default: null },
    designConfig: { type: Schema.Types.Mixed, default: null },

    clonedFrom: { type: Schema.Types.ObjectId, ref: "QuestionPaper", default: null },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    publishedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

/* Indexes follow the Step 1 convention: Equality → Sort → Range, tenant-scoped. */
QuestionPaperSchema.index({ organizationId: 1, isActive: 1, createdBy: 1, updatedAt: -1 });
QuestionPaperSchema.index({ organizationId: 1, isActive: 1, status: 1, updatedAt: -1 });
QuestionPaperSchema.index({ organizationId: 1, isActive: 1, subject: 1, status: 1, updatedAt: -1 });
QuestionPaperSchema.index({ organizationId: 1, isActive: 1, board: 1, exam: 1, year: -1 });
QuestionPaperSchema.index({ organizationId: 1, title: "text" }, { name: "paper_title_search" });

export const QuestionPaper: Model<IQuestionPaper> =
  (models.QuestionPaper as Model<IQuestionPaper>) ??
  model<IQuestionPaper>("QuestionPaper", QuestionPaperSchema);

export default QuestionPaper;
