import { Schema, model, models, Types } from "mongoose";

const ChapterSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    chapterNo: {
      type: Number,
      default: 0,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

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

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    order: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

ChapterSchema.index(
  {
    subject: 1,
    slug: 1,
  },
  {
    unique: true,
  },
);

export default models.Chapter || model("Chapter", ChapterSchema);
