import { Schema, Types, model, models, type Model } from "mongoose";

import {
  DIFFICULTIES,
  LANGUAGES,
  QUESTION_STATUSES,
  QUESTION_TYPES,
  type Difficulty,
  type Language,
  type QuestionStatus,
  type QuestionType,
} from "@/types/question";

/* ==========================================================================
   Sub-schemas
   The polymorphic option/content/answer design is carried over from the
   previous project. It handled ten question types cleanly and is worth keeping.
   ========================================================================== */

export interface IQuestionOption {
  id: string;
  text: string;
  image: string;
  explanation: string;
}

const OptionSchema = new Schema<IQuestionOption>(
  {
    id: { type: String, required: true, trim: true, maxlength: 8 },
    text: { type: String, default: "", trim: true, maxlength: 2000 },
    image: { type: String, default: "", maxlength: 2048 },
    explanation: { type: String, default: "", maxlength: 2000 },
  },
  { _id: false },
);

export interface IQuestionContent {
  text: string;
  image: string;
  audio: string;
  video: string;
  passage: string;
  latex: string;
}

const QuestionContentSchema = new Schema<IQuestionContent>(
  {
    text: { type: String, required: true, trim: true, maxlength: 5000 },
    image: { type: String, default: "", maxlength: 2048 },
    audio: { type: String, default: "", maxlength: 2048 },
    video: { type: String, default: "", maxlength: 2048 },
    passage: { type: String, default: "", maxlength: 20000 },
    latex: { type: String, default: "", maxlength: 5000 },
  },
  { _id: false },
);

export interface IMatchingPair {
  left: string;
  right: string;
}

const MatchingPairSchema = new Schema<IMatchingPair>(
  {
    left: { type: String, required: true, trim: true, maxlength: 500 },
    right: { type: String, required: true, trim: true, maxlength: 500 },
  },
  { _id: false },
);

export interface IQuestionAnswer {
  text: string;
  correctOptions: string[];
  booleanAnswer: boolean | null;
  matchingPairs: IMatchingPair[];
}

const AnswerSchema = new Schema<IQuestionAnswer>(
  {
    text: { type: String, default: "", trim: true, maxlength: 10000 },
    correctOptions: { type: [String], default: [] },
    booleanAnswer: { type: Boolean, default: null },
    matchingPairs: { type: [MatchingPairSchema], default: [] },
  },
  { _id: false },
);

/* ==========================================================================
   Question
   ========================================================================== */

export interface IQuestion {
  _id: Types.ObjectId;

  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  topic: Types.ObjectId | null;
  board: Types.ObjectId | null;
  exam: Types.ObjectId | null;

  type: QuestionType;
  difficulty: Difficulty | null;
  language: Language;

  question: IQuestionContent;
  options: IQuestionOption[];
  answer: IQuestionAnswer;
  explanation: string;

  /** SHA-256 of chapter + normalised question text. Enforces DB-level dedupe. */
  contentHash: string;

  source: string;
  session: string;
  year: number | null;
  marks: number;
  estimatedTime: number;
  tags: string[];

  aiGenerated: boolean;

  status: QuestionStatus;
  isActive: boolean;

  createdBy: Types.ObjectId;
  updatedBy: Types.ObjectId | null;
  approvedBy: Types.ObjectId | null;
  approvedAt: Date | null;
  reviewNote: string;

  createdAt: Date;
  updatedAt: Date;
}

const QuestionSchema = new Schema<IQuestion>(
  {
    category: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    subject: { type: Schema.Types.ObjectId, ref: "Subject", required: true },
    chapter: { type: Schema.Types.ObjectId, ref: "Chapter", required: true },
    topic: { type: Schema.Types.ObjectId, ref: "Topic", default: null },
    board: { type: Schema.Types.ObjectId, ref: "Board", default: null },
    exam: { type: Schema.Types.ObjectId, ref: "Exam", default: null },

    type: { type: String, enum: QUESTION_TYPES, required: true },
    difficulty: { type: String, enum: [...DIFFICULTIES, null], default: null },
    language: { type: String, enum: LANGUAGES, default: "bn" },

    question: { type: QuestionContentSchema, required: true },
    options: { type: [OptionSchema], default: [] },
    answer: { type: AnswerSchema, required: true },
    explanation: { type: String, default: "", maxlength: 10000 },

    contentHash: { type: String, required: true },

    source: { type: String, default: "", trim: true, maxlength: 200 },
    session: { type: String, default: "", trim: true, maxlength: 80 },
    year: { type: Number, default: null, min: 1900, max: 2200 },
    marks: { type: Number, default: 1, min: 0, max: 1000 },
    estimatedTime: { type: Number, default: 60, min: 0, max: 86400 },
    tags: { type: [String], default: [] },

    aiGenerated: { type: Boolean, default: false },

    status: { type: String, enum: QUESTION_STATUSES, default: "DRAFT" },
    isActive: { type: Boolean, default: true },

    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    reviewNote: { type: String, default: "", maxlength: 2000 },
  },
  { timestamps: true },
);

/* ==========================================================================
   Indexes — designed around the queries this application actually runs.

   Every list query is `{ isActive, status?, <taxonomy filters> }` sorted by
   `createdAt: -1`. The previous project had no index containing `createdAt`, so
   every list performed an in-memory sort. These follow Equality → Sort → Range
   ordering so the sort is served by the index.
   ========================================================================== */

// Primary list/browse path.
QuestionSchema.index({ isActive: 1, status: 1, subject: 1, createdAt: -1 });
// Chapter-scoped filtering, used by question pickers and (in Step 2) the paper builder.
QuestionSchema.index({ isActive: 1, chapter: 1, type: 1, difficulty: 1, createdAt: -1 });
// "My questions" / moderation queues.
QuestionSchema.index({ createdBy: 1, createdAt: -1 });
QuestionSchema.index({ status: 1, createdAt: -1 });
// Past-paper lookups.
QuestionSchema.index({ isActive: 1, board: 1, exam: 1, year: -1 });
// Tag filtering.
QuestionSchema.index({ tags: 1 });
// Language/AI provenance filters.
QuestionSchema.index({ isActive: 1, language: 1, aiGenerated: 1 });
// Full-text search over question text and tags (used by $text, not $regex).
// `language_override` is pointed at a field that doesn't exist on the document —
// otherwise MongoDB reads our own `language` field ("bn"/"en") as its per-document
// text-search language override, and "bn" isn't a language MongoDB's text index
// engine understands, which fails the index build outright.
QuestionSchema.index(
  { "question.text": "text", tags: "text" },
  {
    weights: { "question.text": 10, tags: 3 },
    name: "question_text_search",
    language_override: "textSearchLanguage",
  },
);
// Database-level duplicate prevention — not a check-then-insert race.
QuestionSchema.index({ chapter: 1, contentHash: 1 }, { unique: true });

export const Question: Model<IQuestion> =
  (models.Question as Model<IQuestion>) ?? model<IQuestion>("Question", QuestionSchema);

export default Question;
