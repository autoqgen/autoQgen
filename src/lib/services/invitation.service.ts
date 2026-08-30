import { Types } from "mongoose";

import { organizationRepository } from "@/lib/repositories/organization.repo";
import { organizationMemberRepository } from "@/lib/repositories/organization-member.repo";
import { organizationInvitationRepository } from "@/lib/repositories/organization-invitation.repo";
import { userRepository } from "@/lib/repositories/user.repo";
import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import { env, exposeResetUrlInLogs } from "@/lib/config/env";
import { logger } from "@/lib/logger";
import { randomToken, sha256 } from "@/lib/security/hash";
import { sendEmail } from "@/lib/email";
import { invitationEmail } from "@/lib/email/templates/invitation";
import type { AuthContext } from "@/lib/auth/session";
import { toSkip } from "@/lib/validation/common";
import type { CreateInvitationInput, InvitationListQuery } from "@/lib/validation/organization.schema";
import type { IOrganizationInvitation } from "@/models";

/** 7 days — same order of magnitude as PasswordResetToken's 1 hour, scaled up because accepting requires the invitee to notice, and possibly register, first. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_TTL_DAYS = INVITATION_TTL_MS / (24 * 60 * 60 * 1000);

function serializeInvitation(invitation: IOrganizationInvitation) {
  return {
    id: invitation._id.toString(),
    organizationId: invitation.organizationId.toString(),
    email: invitation.email,
    role: invitation.role,
    teamId: invitation.teamId ? invitation.teamId.toString() : null,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
  };
}

export const invitationService = {
  buildAcceptUrl(token: string): string {
    const base = env.NEXTAUTH_URL.replace(/\/$/, "");
    return `${base}/invitations/${encodeURIComponent(token)}`;
  },

  async invite(
    organizationId: string,
    input: CreateInvitationInput,
    actor: AuthContext,
    audit: AuditContext,
  ) {
    const org = await organizationRepository.findById(organizationId);
    if (!org) throw new NotFoundError("Organization");

    const existingUser = await userRepository.findByEmail(input.email);
    if (existingUser) {
      const existingMembership = await organizationMemberRepository.findAnyForUserOrg(
        existingUser.id,
        organizationId,
      );
      if (existingMembership && existingMembership.status === "active") {
        throw new ConflictError("This person is already a member of this organization.");
      }
    }

    const existingPending = await organizationInvitationRepository.findPendingByOrgAndEmail(
      organizationId,
      input.email,
    );
    if (existingPending) {
      throw new ConflictError("An invitation is already pending for this email.");
    }

    const token = randomToken(32);
    const tokenHash = sha256(token);

    const invitation = await organizationInvitationRepository.create({
      organizationId,
      email: input.email,
      role: input.role,
      teamId: input.teamId ? new Types.ObjectId(input.teamId) : null,
      invitedBy: actor.objectId,
      tokenHash,
      expiresAt: new Date(Date.now() + INVITATION_TTL_MS),
    });

    const acceptUrl = this.buildAcceptUrl(token);

    const result = await sendEmail(
      invitationEmail({
        recipientEmail: input.email,
        organizationName: org.name,
        role: input.role,
        acceptUrl,
        expiresInDays: INVITATION_TTL_DAYS,
        supportEmail: env.EMAIL_SUPPORT,
      }),
    );

    if (exposeResetUrlInLogs) {
      // Development convenience only; forced off in production, same flag
      // password-reset uses for the identical "no real SMTP" situation.
      logger.warn("DEV ONLY — organization invitation URL", { acceptUrl });
    }

    logger.info("Organization invitation issued", {
      organizationId,
      invitationId: invitation._id.toString(),
      delivered: result.delivered,
    });

    await auditService.record(
      {
        action: "organization.invitation.send",
        resourceType: "organization_invitation",
        resourceId: invitation._id.toString(),
        metadata: { organizationId, email: input.email, role: input.role },
      },
      audit,
    );

    return serializeInvitation(invitation);
  },

  async listForOrg(organizationId: string, query: InvitationListQuery) {
    const { items, total } = await organizationInvitationRepository.listForOrg({
      organizationId,
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
    });
    return { items: items.map(serializeInvitation), total };
  },

  /** Pending invitations addressed to the logged-in user's own email. */
  async listMine(email: string) {
    const items = await organizationInvitationRepository.listPendingForEmail(email);
    return items.map((invitation) => {
      const org = invitation.organizationId as unknown as { _id: Types.ObjectId; name?: string } | Types.ObjectId;
      const populated = org && typeof org === "object" && "name" in org ? org : null;
      return {
        ...serializeInvitation(invitation),
        organizationName: populated?.name ?? "",
      };
    });
  },

  /**
   * Resolves the emailed deep link for an invitee who isn't logged in yet.
   * Returns only what's safe to show pre-authentication — never the token
   * itself, and no indication of *why* a lookup failed (bad token vs.
   * expired vs. already resolved all render the same "not available" state).
   */
  async resolveByToken(token: string) {
    const tokenHash = sha256(token);
    const invitation = await organizationInvitationRepository.findByTokenHash(tokenHash);
    if (!invitation) return null;

    const org = await organizationRepository.findById(invitation.organizationId);

    return {
      id: invitation._id.toString(),
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      organizationName: org?.name ?? "",
      expiresAt: invitation.expiresAt.toISOString(),
    };
  },

  async cancel(organizationId: string, invitationId: string, audit: AuditContext) {
    const invitation = await organizationInvitationRepository.findById(invitationId);
    if (!invitation || invitation.organizationId.toString() !== organizationId) {
      throw new NotFoundError("Invitation");
    }
    if (invitation.status !== "pending") {
      throw new ValidationError("Only pending invitations can be cancelled.");
    }

    await organizationInvitationRepository.markCancelled(invitationId);

    await auditService.record(
      {
        action: "organization.invitation.cancel",
        resourceType: "organization_invitation",
        resourceId: invitationId,
        metadata: { organizationId, email: invitation.email },
      },
      audit,
    );
  },

  async accept(invitationId: string, user: AuthContext, audit: AuditContext) {
    const invitation = await organizationInvitationRepository.findById(invitationId);
    if (!invitation || invitation.email !== user.email.toLowerCase()) {
      throw new NotFoundError("Invitation");
    }
    if (invitation.status !== "pending") {
      throw new ValidationError("This invitation is no longer pending.");
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      await organizationInvitationRepository.markExpired(invitation._id.toString());
      throw new ValidationError("This invitation has expired.");
    }

    const marked = await organizationInvitationRepository.markAccepted(invitation._id.toString());
    if (!marked) {
      throw new ValidationError("This invitation has already been responded to.");
    }

    // A user belongs to only one organization at a time — accepting a new
    // invitation replaces any prior membership rather than adding a second one.
    await organizationRepository.vacateOwnershipExcept(user.objectId, invitation.organizationId);
    await organizationMemberRepository.removeOtherMemberships(user.objectId, invitation.organizationId);

    await organizationMemberRepository.upsertRole({
      userId: user.objectId,
      organizationId: invitation.organizationId,
      role: invitation.role,
      teamId: invitation.teamId,
      invitedBy: invitation.invitedBy,
    });

    // Accepting is an explicit intent to work in this org — switch current context to it.
    await userRepository.setCurrentOrganization(user.objectId, invitation.organizationId);

    await auditService.record(
      {
        action: "organization.invitation.accept",
        resourceType: "organization_invitation",
        resourceId: invitationId,
        metadata: { organizationId: invitation.organizationId.toString(), role: invitation.role },
      },
      audit,
    );

    return { organizationId: invitation.organizationId.toString(), role: invitation.role };
  },

  async reject(invitationId: string, user: AuthContext, audit: AuditContext) {
    const invitation = await organizationInvitationRepository.findById(invitationId);
    if (!invitation || invitation.email !== user.email.toLowerCase()) {
      throw new NotFoundError("Invitation");
    }
    if (invitation.status !== "pending") {
      throw new ValidationError("This invitation is no longer pending.");
    }

    const marked = await organizationInvitationRepository.markRejected(invitation._id.toString());
    if (!marked) {
      throw new ValidationError("This invitation has already been responded to.");
    }

    await auditService.record(
      {
        action: "organization.invitation.reject",
        resourceType: "organization_invitation",
        resourceId: invitationId,
        metadata: { organizationId: invitation.organizationId.toString() },
      },
      audit,
    );
  },
};
