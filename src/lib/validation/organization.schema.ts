import { z } from "zod";

import {
  objectIdSchema,
  optionalObjectIdSchema,
  optionalTextSchema,
  paginationQuerySchema,
  searchTermSchema,
  shortTextSchema,
  slugSchema,
} from "@/lib/validation/common";
import { ORG_MEMBER_STATUSES, ORG_ROLES } from "@/types/organization";

/**
 * Organization / membership / invitation / team input validation.
 *
 * Server-derived fields (`organizationId`, `invitedBy`, `createdBy`, the
 * membership `userId`) are never accepted from the client — they come from
 * the resolved current organization and the authenticated actor, same
 * convention as `question.schema.ts` omitting `createdBy`.
 */

// ---------------------------------------------------------------------------
// Organizations (Super Admin)
// ---------------------------------------------------------------------------

export const createOrganizationSchema = z.object({
  name: shortTextSchema(160, "Organization name"),
  slug: slugSchema,
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = z.object({
  name: shortTextSchema(160, "Organization name").optional(),
  slug: slugSchema.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export const organizationListQuerySchema = paginationQuerySchema.extend({
  search: searchTermSchema,
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});
export type OrganizationListQuery = z.infer<typeof organizationListQuerySchema>;

export const assignOwnerSchema = z.object({
  userId: objectIdSchema,
});
export type AssignOwnerInput = z.infer<typeof assignOwnerSchema>;

// ---------------------------------------------------------------------------
// Roles assignable by an Organization Owner (never "organization_owner" —
// that requires the Super Admin owner-assignment endpoint).
// ---------------------------------------------------------------------------

export const assignableOrgRoleSchema = z.enum(ORG_ROLES).refine((role) => role !== "organization_owner", {
  message: "organization_owner cannot be assigned this way — use owner assignment instead.",
});

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export const memberListQuerySchema = paginationQuerySchema.extend({
  search: searchTermSchema,
  role: z.enum(ORG_ROLES).optional(),
});
export type MemberListQuery = z.infer<typeof memberListQuerySchema>;

export const updateMemberSchema = z
  .object({
    role: assignableOrgRoleSchema.optional(),
    status: z.enum(ORG_MEMBER_STATUSES).optional(),
    teamId: optionalObjectIdSchema,
  })
  .refine((value) => value.role !== undefined || value.status !== undefined || value.teamId !== undefined, {
    message: "Must provide role, status or teamId to update.",
  });
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export const createInvitationSchema = z.object({
  email: z.string().trim().toLowerCase().email("Must be a valid email address.").max(254),
  role: assignableOrgRoleSchema,
  teamId: optionalObjectIdSchema,
});
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const invitationListQuerySchema = paginationQuerySchema;
export type InvitationListQuery = z.infer<typeof invitationListQuerySchema>;

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

export const createTeamSchema = z.object({
  name: shortTextSchema(160, "Team name"),
  description: optionalTextSchema(1000),
});
export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export const updateTeamSchema = z.object({
  name: shortTextSchema(160, "Team name").optional(),
  description: optionalTextSchema(1000).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

// ---------------------------------------------------------------------------
// Organization switching
// ---------------------------------------------------------------------------

export const switchOrganizationSchema = z.object({
  organizationId: objectIdSchema,
});
export type SwitchOrganizationInput = z.infer<typeof switchOrganizationSchema>;
