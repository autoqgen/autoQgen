import { Schema, model, models, Types } from "mongoose";

const BookmarkSchema = new Schema(
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

    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

/* Prevent duplicate bookmark */
BookmarkSchema.index(
  { user: 1, question: 1 },
  { unique: true }
);

export default models.Bookmark ||
  model("Bookmark", BookmarkSchema);