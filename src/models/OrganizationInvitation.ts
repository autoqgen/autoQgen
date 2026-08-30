import { Schema, Types, model, models, type Model } from "mongoose";

import { INVITATION_STATUSES, ORG_ROLES, type InvitationStatus, type OrgRole } from "@/types/organization";

/**
 * An invitation to join an organization with a specific role.
 *
 * Token cryptography mirrors `PasswordResetToken`: a random token is handed
 * to the invitee (via the invitation email's accept link), only its SHA-256
 * hash is ever persisted. Accepting/rejecting from the in-app "Pending
 * Invitations" list does not need the token at all — it authorizes by
 * matching the invitation's `email` against the logged-in user's session
 * email — the token exists solely to support the emailed deep-link for a
 * not-yet-registered invitee.
 */

export interface IOrganizationInvitation {
  _id: Types.ObjectId;
  organizationId: Types.ObjectId;
  email: string;
  userId: Types.ObjectId | null;
  role: OrgRole;
  teamId: Types.ObjectId | null;
  invitedBy: Types.ObjectId;
  /** SHA-256 of the raw token. The raw token is never stored. */
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  rejectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrganizationInvitationSchema = new Schema<IOrganizationInvitation>(
  {
    organizationId: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 254 },
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    role: { type: String, enum: ORG_ROLES, required: true },
    teamId: { type: Schema.Types.ObjectId, ref: "Team", default: null },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true, unique: true },
    status: { type: String, enum: INVITATION_STATUSES, default: "pending", required: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// "My pending invitations" — looked up by the logged-in user's email.
OrganizationInvitationSchema.index({ email: 1, status: 1 });
// An org's sent invitations, most recent first.
OrganizationInvitationSchema.index({ organizationId: 1, createdAt: -1 });
/**
 * At most one *pending* invitation per (organization, email). A partial index
 * so past rejected/expired/cancelled invitations don't block re-inviting the
 * same address later — same scoped-uniqueness idiom as Subject's
 * {category, slug} index, just with a status filter instead of a parent ref.
 */
OrganizationInvitationSchema.index(
  { organizationId: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

export const OrganizationInvitation: Model<IOrganizationInvitation> =
  (models.OrganizationInvitation as Model<IOrganizationInvitation>) ??
  model<IOrganizationInvitation>("OrganizationInvitation", OrganizationInvitationSchema);

export default OrganizationInvitation;
