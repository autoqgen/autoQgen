import { Schema, model, models } from "mongoose";

const BoardSchema = new Schema(
  {
    // Board name
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    // URL friendly name
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // Short code
    shortName: {
      type: String,
      default: "",
      trim: true,
    },

    // Country
    country: {
      type: String,
      default: "Bangladesh",
      trim: true,
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

BoardSchema.index({
  order: 1,
  isActive: 1,
});

export default models.Board || model("Board", BoardSchema);
