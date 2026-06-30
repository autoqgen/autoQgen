import mongoose, { Schema, Types, model, models } from "mongoose";
import { Difficulty, QuestionType } from "@/types/question";

/* ======================================================
   OPTION SCHEMA
   ====================================================== */

const OptionSchema = new Schema(
  {
    id: {
      type: String,
      required: true, // A, B, C, D
      trim: true,
    },

    text: {
      type: String,
      default: "",
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    explanation: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  },
);

/* ======================================================
   QUESTION CONTENT
   ====================================================== */

const QuestionContentSchema = new Schema(
  {
    text: {
      type: String,
      required: true,
      trim: true,
    },

    image: {
      type: String,
      default: "",
    },

    audio: {
      type: String,
      default: "",
    },

    video: {
      type: String,
      default: "",
    },

    passage: {
      type: String,
      default: "",
    },

    latex: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  },
);

/* ======================================================
   MATCHING PAIR
   ====================================================== */

const MatchingPairSchema = new Schema(
  {
    left: {
      type: String,
      required: true,
    },

    right: {
      type: String,
      required: true,
    },
  },
  {
    _id: false,
  },
);

/* ======================================================
   ANSWER SCHEMA
   ====================================================== */

const AnswerSchema = new Schema(
  {
    // Written / Short / Fill Blank
    text: {
      type: String,
      default: "",
    },

    // MCQ / Multiple Correct
    correctOptions: {
      type: [String],
      default: [],
    },

    // True / False
    booleanAnswer: {
      type: Boolean,
      default: null,
    },

    // Matching
    matchingPairs: {
      type: [MatchingPairSchema],
      default: [],
    },

    // Future Extension
    extra: {
      type: Schema.Types.Mixed,
      default: null,
    },
  },
  {
    _id: false,
  },
);
/* ======================================================
   MAIN QUESTION SCHEMA
====================================================== */

const QuestionSchema = new Schema(
  {
    /* =====================
       RELATIONS
    ===================== */

    category: {
      type: Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    subject: {
      type: Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },

    chapter: {
      type: Types.ObjectId,
      ref: "Chapter",
      required: true,
      index: true,
    },

    topic: {
      type: Types.ObjectId,
      ref: "Topic",
      default: null,
      index: true,
    },

    board: {
      type: Types.ObjectId,
      ref: "Board",
      default: null,
    },

    exam: {
      type: Types.ObjectId,
      ref: "Exam",
      default: null,
    },

    /* =====================
       QUESTION INFO
    ===================== */

    type: {
      type: String,
      enum: Object.values(QuestionType),
      required: true,
      index: true,
    },

    difficulty: {
      type: String,
      enum: Object.values(Difficulty),
      default: null, // Optional
      index: true,
    },

    language: {
      type: String,
      default: "bn",
    },

    question: {
      type: QuestionContentSchema,
      required: true,
    },

    options: {
      type: [OptionSchema],
      default: [],
    },

    answer: {
      type: AnswerSchema,
      required: true,
    },

    explanation: {
      type: String,
      default: "",
    },

    /* =====================
       METADATA
    ===================== */

    source: {
      type: String,
      default: "",
    },

    session: {
      type: String,
      default: "",
    },

    year: {
      type: Number,
    },

    marks: {
      type: Number,
      default: 1,
    },

    estimatedTime: {
      type: Number,
      default: 60, // seconds
    },

    tags: {
      type: [String],
      default: [],
      index: true,
    },

    /* =====================
       AI
    ===================== */

    aiGenerated: {
      type: Boolean,
      default: false,
    },

    /* =====================
       ANALYTICS
    ===================== */

    viewCount: {
      type: Number,
      default: 0,
    },

    attemptCount: {
      type: Number,
      default: 0,
    },

    correctCount: {
      type: Number,
      default: 0,
    },

    /* =====================
       STATUS
    ===================== */

    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "APPROVED", "REJECTED"],
      default: "DRAFT",
      index: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    /* =====================
       USER TRACKING
    ===================== */

    createdBy: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedBy: {
      type: Types.ObjectId,
      ref: "User",
      default: null,
    },

    publishedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

/* ======================================================
   INDEXES
====================================================== */

QuestionSchema.index({
  category: 1,
  subject: 1,
  chapter: 1,
  topic: 1,
});

QuestionSchema.index({
  type: 1,
  difficulty: 1,
  language: 1,
});

QuestionSchema.index({
  board: 1,
  exam: 1,
  year: 1,
});

QuestionSchema.index({
  status: 1,
  isActive: 1,
});

QuestionSchema.index({
  tags: 1,
});

QuestionSchema.index({
  "question.text": "text",
});

/* ======================================================
   EXPORT
====================================================== */

export default models.Question || model("Question", QuestionSchema);
