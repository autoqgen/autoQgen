import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { AuditContext } from "@/lib/services/audit.service";
import type { UserRole } from "@/types/roles";

/**
 * Admin Center → Users & Roles: assigning a user an organization + a role
 * *within* that organization, kept strictly separate from the global
 * `User.role`, and the "one organization at a time" invariant.
 *
 * See organization-service.test.ts for why the harness is resolved with a
 * top-level await rather than inside beforeAll.
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

describe.skipIf(!available)("setUserOrganization (admin Users & Roles)", () => {
  async function setup() {
    const { User, Organization, OrganizationMember } = await import("@/models");
    const superAdmin = await User.create({
      name: "Super",
      email: "super@example.com",
      password: "x",
      role: "super_admin",
    });
    return {
      User,
      Organization,
      OrganizationMember,
      superAdmin,
      superActor: actorFor(superAdmin._id, "super_admin"),
    };
  }

  async function createOrg(name: string, slug: string, superAdminId: Types.ObjectId) {
    const { organizationService } = await import("@/lib/services/organization.service");
    const actor = actorFor(superAdminId, "super_admin");
    return organizationService.create({ name, slug }, actor, auditFor(actor));
  }

  it("assigns an organization role independent of the global User.role", async () => {
    const { organizationMemberService } = await import("@/lib/services/organization-member.service");
    const { User, Organization, superActor } = await setup();

    const org = await Organization.create({ name: "ABC Organization", slug: "abc" });
    const user = await User.create({ name: "Casey", email: "casey@example.com", password: "x", role: "teacher" });

    const result = await organizationMemberService.setUserOrganization(
      { userId: user._id, currentOrganizationId: null },
      { organizationId: org._id.toString(), role: "content_writer" },
      superActor,
      auditFor(superActor),
    );

    expect(result).toEqual({
      organizationId: org._id.toString(),
      organizationRole: "content_writer",
    });

    const { OrganizationMember } = await import("@/models");
    const membership = await OrganizationMember.findOne({ userId: user._id, organizationId: org._id }).exec();
    expect(membership?.role).toBe("content_writer");
    expect(membership?.status).toBe("active");

    const reloaded = await User.findById(user._id).exec();
    expect(reloaded?.role).toBe("teacher"); // global role untouched
    expect(reloaded?.organization?.toString()).toBe(org._id.toString()); // context switched
  });

  it("changes only the organization role when no organizationId is supplied", async () => {
    const { organizationMemberService } = await import("@/lib/services/organization-member.service");
    const { User, Organization, OrganizationMember, superActor } = await setup();

    const org = await Organization.create({ name: "ABC Organization", slug: "abc" });
    const user = await User.create({ name: "Devon", email: "devon@example.com", password: "x", role: "member" });

    await organizationMemberService.setUserOrganization(
      { userId: user._id, currentOrganizationId: null },
      { organizationId: org._id.toString(), role: "reviewer" },
      superActor,
      auditFor(superActor),
    );

    const result = await organizationMemberService.setUserOrganization(
      { userId: user._id, currentOrganizationId: org._id.toString() },
      { role: "teacher" },
      superActor,
      auditFor(superActor),
    );

    expect(result.organizationId).toBe(org._id.toString());
    expect(result.organizationRole).toBe("teacher");

    const membership = await OrganizationMember.findOne({ userId: user._id, organizationId: org._id }).exec();
    expect(membership?.role).toBe("teacher");
  });

  it("rejects an organization role with no organization to apply it to", async () => {
    const { organizationMemberService } = await import("@/lib/services/organization-member.service");
    const { User, superActor } = await setup();
    const user = await User.create({ name: "Erin", email: "erin@example.com", password: "x", role: "member" });

    await expect(
      organizationMemberService.setUserOrganization(
        { userId: user._id, currentOrganizationId: null },
        { role: "teacher" },
        superActor,
        auditFor(superActor),
      ),
    ).rejects.toThrow();
  });

  it("assigning organization_owner sets Organization.owner and demotes the previous owner", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { organizationMemberService } = await import("@/lib/services/organization-member.service");
    const { User, Organization, OrganizationMember, superAdmin, superActor } = await setup();

    const org = await createOrg("ABC Organization", "abc", superAdmin._id);
    const prevOwner = await User.create({ name: "Prev", email: "prev@example.com", password: "x", role: "teacher" });
    await organizationService.assignOwner(org.id, { userId: prevOwner._id.toString() }, superActor, auditFor(superActor));

    const newOwner = await User.create({ name: "Next", email: "next@example.com", password: "x", role: "teacher" });

    const result = await organizationMemberService.setUserOrganization(
      { userId: newOwner._id, currentOrganizationId: null },
      { organizationId: org.id, role: "organization_owner" },
      superActor,
      auditFor(superActor),
    );
    expect(result.organizationRole).toBe("organization_owner");

    const orgDoc = await Organization.findById(org.id).exec();
    expect(orgDoc?.owner?.toString()).toBe(newOwner._id.toString());

    const prevMembership = await OrganizationMember.findOne({ userId: prevOwner._id, organizationId: org.id }).exec();
    const newMembership = await OrganizationMember.findOne({ userId: newOwner._id, organizationId: org.id }).exec();
    expect(prevMembership?.role).toBe("team_admin");
    expect(newMembership?.role).toBe("organization_owner");

    // Global roles of both users are untouched.
    expect((await User.findById(prevOwner._id).exec())?.role).toBe("teacher");
    expect((await User.findById(newOwner._id).exec())?.role).toBe("teacher");
  });

  it("moving an owner into another organization vacates their old organization's ownership", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { organizationMemberService } = await import("@/lib/services/organization-member.service");
    const { User, Organization, OrganizationMember, superAdmin, superActor } = await setup();

    const abc = await createOrg("ABC Organization", "abc", superAdmin._id);
    const xyz = await createOrg("XYZ Organization", "xyz", superAdmin._id);
    const owner = await User.create({ name: "Frankie", email: "frankie@example.com", password: "x", role: "teacher" });
    await organizationService.assignOwner(abc.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));

    await organizationMemberService.setUserOrganization(
      { userId: owner._id, currentOrganizationId: abc.id },
      { organizationId: xyz.id, role: "teacher" },
      superActor,
      auditFor(superActor),
    );

    expect((await Organization.findById(abc.id).exec())?.owner).toBeNull();
    expect(await OrganizationMember.findOne({ userId: owner._id, organizationId: abc.id }).exec()).toBeNull();

    const xyzMembership = await OrganizationMember.findOne({ userId: owner._id, organizationId: xyz.id }).exec();
    expect(xyzMembership?.role).toBe("teacher");
    expect((await User.findById(owner._id).exec())?.organization?.toString()).toBe(xyz.id);
  });

  it("clearing the organization removes every membership and vacates owned organizations", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { organizationMemberService } = await import("@/lib/services/organization-member.service");
    const { User, Organization, OrganizationMember, superAdmin, superActor } = await setup();

    const org = await createOrg("ABC Organization", "abc", superAdmin._id);
    const owner = await User.create({ name: "Gray", email: "gray@example.com", password: "x", role: "teacher" });
    await organizationService.assignOwner(org.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));

    await organizationMemberService.setUserOrganization(
      { userId: owner._id, currentOrganizationId: org.id },
      { organizationId: null },
      superActor,
      auditFor(superActor),
    );

    expect((await Organization.findById(org.id).exec())?.owner).toBeNull();
    expect(await OrganizationMember.findOne({ userId: owner._id }).exec()).toBeNull();
    expect((await User.findById(owner._id).exec())?.organization ?? null).toBeNull();
  });
});

describe.skipIf(!available)("invitation accept — one organization at a time", () => {
  function actor(id: Types.ObjectId, role: UserRole, email: string): AuthContext {
    return actorFor(id, role, email);
  }

  it("replaces a pre-existing membership when a user accepts another organization's invitation", async () => {
    const { organizationService } = await import("@/lib/services/organization.service");
    const { invitationService } = await import("@/lib/services/invitation.service");
    const { User, OrganizationMember } = await import("@/models");

    const superAdmin = await User.create({ name: "Super", email: "super@example.com", password: "x", role: "super_admin" });
    const superActor = actorFor(superAdmin._id, "super_admin");

    const abc = await organizationService.create({ name: "ABC Organization", slug: "abc" }, superActor, auditFor(superActor));
    const xyz = await organizationService.create({ name: "XYZ Organization", slug: "xyz" }, superActor, auditFor(superActor));

    const owner = await User.create({ name: "Owner", email: "owner@example.com", password: "x", role: "teacher" });
    await organizationService.assignOwner(xyz.id, { userId: owner._id.toString() }, superActor, auditFor(superActor));

    const invitee = await User.create({ name: "Invitee", email: "invitee@example.com", password: "x", role: "teacher" });
    await OrganizationMember.create({
      userId: invitee._id,
      organizationId: abc.id,
      role: "student",
      status: "active",
    });
    await User.updateOne({ _id: invitee._id }, { $set: { organization: abc.id } }).exec();

    const ownerActor = actor(owner._id, "teacher", "owner@example.com");
    const invitation = await invitationService.invite(
      xyz.id,
      { email: "invitee@example.com", role: "reviewer", teamId: null },
      ownerActor,
      auditFor(ownerActor),
    );

    const inviteeActor = actor(invitee._id, "teacher", "invitee@example.com");
    await invitationService.accept(invitation.id, inviteeActor, auditFor(inviteeActor));

    expect(await OrganizationMember.findOne({ userId: invitee._id, organizationId: abc.id }).exec()).toBeNull();
    const xyzMembership = await OrganizationMember.findOne({ userId: invitee._id, organizationId: xyz.id }).exec();
    expect(xyzMembership?.role).toBe("reviewer");
    expect((await User.findById(invitee._id).exec())?.organization?.toString()).toBe(xyz.id);
  });
});
