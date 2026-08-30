import { Schema, Types, model, models, type Model } from "mongoose";

import { ORG_MEMBER_STATUSES, ORG_ROLES, type OrgMemberStatus, type OrgRole } from "@/types/organization";

/**
 * A (user, organization) membership — the authoritative record of "what role
 * does this user hold in this specific organization". Independent of
 * `User.role`, which is a global platform rank untouched by this feature.
 *
 * A user can hold at most one membership per organization (enforced by the
 * unique compound index below) but may belong to many organizations.
 */

export interface IOrganizationMember {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  organizationId: Types.ObjectId;
  role: OrgRole;
  teamId: Types.ObjectId | null;
  status: OrgMemberStatus;
  invitedBy: Types.ObjectId | null;
  joinedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationMemberSchema = new Schema<IOrganizationMember>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    role: { type: String, enum: ORG_ROLES, required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    status: { type: String, enum: ORG_MEMBER_STATUSES, default: "active", required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    joinedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One membership per user per organization.
OrganizationMemberSchema.index({ userId: 1, organizationId: 1 }, { unique: true });
// Member-list queries: "everyone in org X", "everyone in org X with role Y".
OrganizationMemberSchema.index({ organizationId: 1, role: 1 });
OrganizationMemberSchema.index({ organizationId: 1, status: 1 });
OrganizationMemberSchema.index({ organizationId: 1, teamId: 1 });

export const OrganizationMember: Model<IOrganizationMember> =
  (models.OrganizationMember as Model<IOrganizationMember>) ??
  model<IOrganizationMember>("OrganizationMember", OrganizationMemberSchema);

export default OrganizationMember;
