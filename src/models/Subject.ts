import { Schema, model, models, Types } from "mongoose";

const SubjectSchema = new Schema(
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
      unique: true,
    },
    code: {
      type: String,
      default: "",
    },

    category: {
      type: Types.ObjectId,
      ref: "Category",
      required: true,
      index: true,
    },

    classLevel: {
      type: String, // Class 1-12 / Admission / BCS
      default: "",
    },

    group: {
      type: String, // Science / Commerce / Arts
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

export default models.Subject || model("Subject", SubjectSchema);
