import { Schema, model, models, Types } from "mongoose";

const TopicSchema = new Schema(
  {
    // Topic name
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

    // Parent category
    category: {
      type: Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    // Parent subject
    subject: {
      type: Types.ObjectId,
      ref: "Subject",
      required: true,
      index: true,
    },

    // Parent chapter
    chapter: {
      type: Types.ObjectId,
      ref: "Chapter",
      required: true,
      index: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    order: {
      type: Number,
      default: 0,
    },

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

// Prevent duplicate topic inside same chapter
TopicSchema.index(
  {
    chapter: 1,
    slug: 1,
  },
  {
    unique: true,
  },
);

export default models.Topic || model("Topic", TopicSchema);
