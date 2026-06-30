import { Schema, model, models, Types } from "mongoose";

const WrongAnswerSchema = new Schema(
  {
    user: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    question: {
      type: Types.ObjectId,
      ref: "Question",
      required: true,
      index: true,
    },

    selectedAnswer: {
      type: Schema.Types.Mixed, // MCQ, text, boolean সব handle করবে
      required: true,
    },

    correctAnswer: {
      type: Schema.Types.Mixed,
      required: true,
    },

    isReviewed: {
      type: Boolean,
      default: false,
    },

    reviewNote: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/* Optional: avoid duplicate wrong entries */
WrongAnswerSchema.index(
  { user: 1, question: 1 },
  { unique: true }
);

export default models.WrongAnswer ||
  model("WrongAnswer", WrongAnswerSchema);