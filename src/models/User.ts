import { Schema, Types, model, models, type Model } from "mongoose";

import { USER_ROLES, USER_STATUSES, type UserRole, type UserStatus } from "@/types/roles";

export interface IUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
  /**
   * bcrypt hash. `select: false` means it is excluded from every query unless a
   * caller explicitly opts in with `.select("+password")`. Only the credentials
   * authorize() path and the change-password service are permitted to do so.
   */
  password?: string;
  image?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: Date | null;
  organization: Types.ObjectId | null;
  /**
   * Incremented on password change and forced logout. The JWT carries the value
   * it was minted with; a mismatch invalidates the session immediately.
   */
  tokenVersion: number;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      index: true,
    },
    password: {
      type: String,
      select: false,
      maxlength: 200,
    },
    image: {
      type: String,
      default: "",
      maxlength: 2000000,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "teacher",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: USER_STATUSES,
      default: "active",
      required: true,
      index: true,
    },
    emailVerified: {
      type: Date,
      default: null,
    },
    organization: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },
    tokenVersion: {
      type: Number,
      default: 0,
      required: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    // Belt and braces: even a stray `res.json(user)` cannot leak the hash.
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.password;
        delete ret.tokenVersion;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret: Record<string, unknown>) {
        delete ret.password;
        return ret;
      },
    },
  },
);

export const User: Model<IUser> = (models.User as Model<IUser>) ?? model<IUser>("User", UserSchema);

export default User;
