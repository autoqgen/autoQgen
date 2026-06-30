import { Schema, model, models, Types } from "mongoose";

const ExamSchema = new Schema(
  {
    // Exam name
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // URL friendly name
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    // Exam type
    type: {
      type: String,
      enum: ["SSC", "HSC", "ADMISSION", "BCS", "JOB", "OTHER"],
      default: "OTHER",
      index: true,
    },

    // Optional category reference
    category: {
      type: Types.ObjectId,
      ref: "Category",
      default: null,
      index: true,
    },

    // Optional board reference
    board: {
      type: Types.ObjectId,
      ref: "Board",
      default: null,
      index: true,
    },

    // Exam year
    year: {
      type: Number,
      default: null,
      index: true,
    },

    // Session
    session: {
      type: String,
      default: "",
    },

    // Description
    description: {
      type: String,
      default: "",
    },

    // Sort order
    order: {
      type: Number,
      default: 0,
    },

    // Soft delete
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Prevent duplicate exam
ExamSchema.index(
  {
    slug: 1,
    year: 1,
  },
  {
    unique: true,
  },
);

export default models.Exam || model("Exam", ExamSchema);
