import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { AuditContext } from "@/lib/services/audit.service";
import type { UserRole } from "@/types/roles";
import { createInvitationSchema, updateMemberSchema } from "@/lib/validation/organization.schema";

/**
 * Resolved via top-level await, not inside beforeAll: describe.skipIf below
 * reads `available` synchronously while the describe body is registered,
 * which happens *before* beforeAll ever runs — so a beforeAll-set flag is
 * always still `false` at that point and the suite silently always skips.
 * Top-level await ensures collection itself waits for the real value.
 */
const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

function actorFor(id: Types.ObjectId, role: UserRole, email?: string): AuthContext {
  return {
    id: id.toString(),
    objectId: id,
    email: email ?? `${role}-${id.toString()}@example.com`,
    name: role,
    role,
    status: "active",
    organizationId: null,
  };
}

function auditFor(actor: AuthContext): AuditContext {
  return { actor, requestId: "test", ip: "test" };
}

// Validation lives at the API boundary, not the service layer (matching the
// rest of this codebase's convention) — these run unconditionally, no DB.
describe("organization role-assignment ceilings (schema level)", () => {
  it("never accepts organization_owner as an assignable invitation role", () => {
    const result = createInvitationSchema.safeParse({ email: "a@example.com", role: "organization_owner" });
    expect(result.success).toBe(false);
  });

  it("never accepts organization_owner as an assignable member-update role", () => {
    const result = updateMemberSchema.safeParse({ role: "organization_owner" });
    expect(result.success).toBe(false);
  });

  it("accepts an ordinary assignable role", () => {
    expect(createInvitationSchema.safeParse({ email: "a@example.com", role: "team_admin" }).success).toBe(true);
    expect(updateMemberSchema.safeParse({ role: "reviewer" }).success).toBe(true);
  });
});

describe.skipIf(!available)("organization service", () => {
  async function seedUsers() {
    const { User } = await import("@/models");
    const superAdmin = await User.create({ name: "Super", email: "super@example.com", password: "x", role: "super_admin" });
    const owner = await User.create({ name: "Owner", email: "owner@example.com", password: "x", role: "teacher" });
    const invitee = await User.create({ name: "Invitee", email: "invitee@example.com", password: "x", role: "teacher" });
    return { superAdmin, owner, invitee };
  }

  async function createOrg(name: string, slug: string, superAdminId: Types.ObjectId) {
    const { organizationService } = await import("@/lib/services/organization.service");
    return organizationService.create({ name, slug }, actorFor(superAdminId, "super_admin"), auditFor(actorFor(superAdminId, "super_admin")));
  }

  it("lets a Super Admin create an organization and assign an existing user as owner", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { OrganizationMember } = await import("@/models");
    const { superAdmin, owner } = await seedUsers();
    const superActor = actorFor(superAdmin._id, "super_admin");

    const org = await createOrg("ABC School", "abc-school", superAdmin._id);
    expect(org.slug).toBe("abc-school");

    const updated = await organizationService.assignOwner(org.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));
    expect(updated.ownerId).toBe(owner._id.toString());

    const membership = await OrganizationMember.findOne({ userId: owner._id, organizationId: org.id }).exec();
    expect(membership?.role).toBe("organization_owner");
    // The owner's global role is untouched by becoming an org owner.
    const { User } = await import("@/models");
    const ownerDoc = await User.findById(owner._id).exec();
    expect(ownerDoc?.role).toBe("teacher");
  });

  it("demotes the previous owner instead of leaving two live organization_owner memberships", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { OrganizationMember } = await import("@/models");
    const { User } = await import("@/models");
    const { superAdmin, owner, invitee } = await seedUsers();
    const superActor = actorFor(superAdmin._id, "super_admin");

    const org = await createOrg("ABC School", "abc-school", superAdmin._id);
    await organizationService.assignOwner(org.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));

    const newOwner = await User.create({ name: "New Owner", email: "newowner@example.com", password: "x", role: "teacher" });
    await organizationService.assignOwner(org.id, { userId: newOwner._id.toString() }, superActor, auditFor(superActor));

    const oldOwnerMembership = await OrganizationMember.findOne({ userId: owner._id, organizationId: org.id }).exec();
    const newOwnerMembership = await OrganizationMember.findOne({ userId: newOwner._id, organizationId: org.id }).exec();
    expect(oldOwnerMembership?.role).toBe("team_admin");
    expect(newOwnerMembership?.role).toBe("organization_owner");
    void invitee;
  });

  it("runs the full invite -> accept flow and creates a membership with the invited role", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { invitationService } = await import("@/lib/services/invitation.service");
    const { OrganizationMember, User } = await import("@/models");
    const { superAdmin, owner, invitee } = await seedUsers();
    const superActor = actorFor(superAdmin._id, "super_admin");

    const org = await createOrg("ABC School", "abc-school", superAdmin._id);
    await organizationService.assignOwner(org.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));
    const ownerActor = actorFor(owner._id, "teacher", "owner@example.com");

    const invitation = await invitationService.invite(
      org.id,
      { email: "invitee@example.com", role: "reviewer", teamId: null },
      ownerActor,
      auditFor(ownerActor),
    );
    expect(invitation.status).toBe("pending");

    const inviteeActor = actorFor(invitee._id, "teacher", "invitee@example.com");
    const result = await invitationService.accept(invitation.id, inviteeActor, auditFor(inviteeActor));
    expect(result.role).toBe("reviewer");

    const membership = await OrganizationMember.findOne({ userId: invitee._id, organizationId: org.id }).exec();
    expect(membership?.role).toBe("reviewer");
    expect(membership?.status).toBe("active");

    // Accepting switches the invitee's current organization context.
    const inviteeDoc = await User.findById(invitee._id).exec();
    expect(inviteeDoc?.organization?.toString()).toBe(org.id);
  });

  it("rejects a duplicate pending invitation to the same email", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { invitationService } = await import("@/lib/services/invitation.service");
    const { superAdmin, owner } = await seedUsers();
    const superActor = actorFor(superAdmin._id, "super_admin");

    const org = await createOrg("ABC School", "abc-school", superAdmin._id);
    await organizationService.assignOwner(org.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));
    const ownerActor = actorFor(owner._id, "teacher", "owner@example.com");

    await invitationService.invite(org.id, { email: "invitee@example.com", role: "reviewer", teamId: null }, ownerActor, auditFor(ownerActor));

    await expect(
      invitationService.invite(org.id, { email: "invitee@example.com", role: "student", teamId: null }, ownerActor, auditFor(ownerActor)),
    ).rejects.toThrow();
  });

  it("rejects acceptance of an expired invitation and marks it expired", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { invitationService } = await import("@/lib/services/invitation.service");
    const { OrganizationInvitation } = await import("@/models");
    const { superAdmin, owner, invitee } = await seedUsers();
    const superActor = actorFor(superAdmin._id, "super_admin");

    const org = await createOrg("ABC School", "abc-school", superAdmin._id);
    await organizationService.assignOwner(org.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));

    const expired = await OrganizationInvitation.create({
      organizationId: new Types.ObjectId(org.id),
      email: "invitee@example.com",
      role: "student",
      teamId: null,
      invitedBy: owner._id,
      tokenHash: "x".repeat(64),
      status: "pending",
      expiresAt: new Date(Date.now() - 1000),
    });

    const inviteeActor = actorFor(invitee._id, "teacher", "invitee@example.com");
    await expect(invitationService.accept(expired._id.toString(), inviteeActor, auditFor(inviteeActor))).rejects.toThrow();

    const reloaded = await OrganizationInvitation.findById(expired._id).exec();
    expect(reloaded?.status).toBe("expired");
  });

  it("cannot accept the same invitation twice", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { invitationService } = await import("@/lib/services/invitation.service");
    const { superAdmin, owner, invitee } = await seedUsers();
    const superActor = actorFor(superAdmin._id, "super_admin");

    const org = await createOrg("ABC School", "abc-school", superAdmin._id);
    await organizationService.assignOwner(org.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));
    const ownerActor = actorFor(owner._id, "teacher", "owner@example.com");

    const invitation = await invitationService.invite(org.id, { email: "invitee@example.com", role: "reviewer", teamId: null }, ownerActor, auditFor(ownerActor));
    const inviteeActor = actorFor(invitee._id, "teacher", "invitee@example.com");

    await invitationService.accept(invitation.id, inviteeActor, auditFor(inviteeActor));
    await expect(invitationService.accept(invitation.id, inviteeActor, auditFor(inviteeActor))).rejects.toThrow();
  });

  it("refuses to remove or demote the organization owner through the member-management endpoint", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { organizationMemberService } = await import("@/lib/services/organization-member.service");
    const { OrganizationMember } = await import("@/models");
    const { superAdmin, owner } = await seedUsers();
    const superActor = actorFor(superAdmin._id, "super_admin");

    const org = await createOrg("ABC School", "abc-school", superAdmin._id);
    await organizationService.assignOwner(org.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));
    const ownerMembership = await OrganizationMember.findOne({ userId: owner._id, organizationId: org.id }).exec();

    await expect(
      organizationMemberService.updateMember(org.id, ownerMembership!._id.toString(), { role: "team_admin", teamId: null }, auditFor(superActor)),
    ).rejects.toThrow();
    await expect(
      organizationMemberService.removeMember(org.id, ownerMembership!._id.toString(), auditFor(superActor)),
    ).rejects.toThrow();
  });

  it("isolates organizations: a member of one org has no membership in another", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { requireOrgMembership } = await import("@/lib/auth/org-session");
    const { superAdmin, owner } = await seedUsers();
    const superActor = actorFor(superAdmin._id, "super_admin");

    const abc = await createOrg("ABC School", "abc-school", superAdmin._id);
    const xyz = await createOrg("XYZ College", "xyz-college", superAdmin._id);
    await organizationService.assignOwner(abc.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));

    const ownerActor = actorFor(owner._id, "teacher", "owner@example.com");

    // ABC's owner has a real membership in ABC...
    await expect(requireOrgMembership(ownerActor, abc.id)).resolves.toBeTruthy();
    // ...but not in XYZ — reported as NotFoundError, not Forbidden, so a
    // non-member cannot even confirm the organization exists.
    await expect(requireOrgMembership(ownerActor, xyz.id)).rejects.toMatchObject({ code: "NOT_FOUND" });

    // Super Admin reaches both organizations through the platform-level path.
    await expect(organizationService.getById(abc.id)).resolves.toBeTruthy();
    await expect(organizationService.getById(xyz.id)).resolves.toBeTruthy();
  });

  it("keeps a Team Admin scoped to their own team", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { teamService } = await import("@/lib/services/team.service");
    const { assertTeamPermission } = await import("@/lib/auth/org-session");
    const { OrganizationMember } = await import("@/models");
    const { superAdmin, owner, invitee } = await seedUsers();
    const superActor = actorFor(superAdmin._id, "super_admin");

    const org = await createOrg("ABC School", "abc-school", superAdmin._id);
    await organizationService.assignOwner(org.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));
    const ownerActor = actorFor(owner._id, "teacher", "owner@example.com");

    const teamA = await teamService.create(org.id, { name: "Team A", description: "" }, ownerActor, auditFor(ownerActor));
    const teamB = await teamService.create(org.id, { name: "Team B", description: "" }, ownerActor, auditFor(ownerActor));

    await OrganizationMember.create({
      userId: invitee._id,
      organizationId: org.id,
      role: "team_admin",
      teamId: teamA.id,
      status: "active",
    });
    const teamAdminMembership = await OrganizationMember.findOne({ userId: invitee._id, organizationId: org.id }).exec();

    expect(() => assertTeamPermission(teamAdminMembership!, teamA.id, "team:update")).not.toThrow();
    expect(() => assertTeamPermission(teamAdminMembership!, teamB.id, "team:update")).toThrow();
  });
});
