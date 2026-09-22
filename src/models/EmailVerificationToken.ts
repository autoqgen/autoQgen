import { Schema, Types, model, models, type Model } from "mongoose";

export interface IEmailVerificationToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const EmailVerificationTokenSchema = new Schema<IEmailVerificationToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

EmailVerificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerificationToken: Model<IEmailVerificationToken> =
  (models.EmailVerificationToken as Model<IEmailVerificationToken>) ??
  model<IEmailVerificationToken>("EmailVerificationToken", EmailVerificationTokenSchema);

export default EmailVerificationToken;