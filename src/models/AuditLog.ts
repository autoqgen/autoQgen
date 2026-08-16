import { Schema, Types, model, models, type Model } from "mongoose";

import { AUDIT_ACTIONS, type AuditAction } from "@/types/audit";
export { AUDIT_ACTIONS, type AuditAction };

export interface IAuditLog {
  _id: Types.ObjectId;
  action: AuditAction;
  actor: Types.ObjectId | null;
  actorRole: string;
  resourceType: string;
  resourceId: string;
  /** Small, non-sensitive summary. Never answers, passwords or tokens. */
  metadata: Record<string, unknown>;
  requestId: string;
  ip: string;
  outcome: "success" | "failure";
  createdAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: "", maxlength: 40 },
    resourceType: { type: String, default: "", maxlength: 40 },
    resourceId: { type: String, default: "", maxlength: 64 },
    metadata: { type: Schema.Types.Mixed, default: {} },
    requestId: { type: String, default: "", maxlength: 64 },
    ip: { type: String, default: "", maxlength: 64 },
    outcome: { type: String, enum: ["success", "failure"], default: "success" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ actor: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });
// Retain for two years, then expire automatically.
AuditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63_072_000 });

export const AuditLog: Model<IAuditLog> =
  (models.AuditLog as Model<IAuditLog>) ?? model<IAuditLog>("AuditLog", AuditLogSchema);

export default AuditLog;
