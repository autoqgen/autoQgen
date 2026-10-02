import { describe, expect, it } from "vitest";
import { can, canAny } from "@/lib/auth/rbac";
import {
  adminUserUpdateSchema,
  validateSelfAccountModification,
  validateSuperAdminRetention,
} from "@/app/api/admin/users/[id]/route";

describe("Admin RBAC Permissions", () => {
  it("limits Admin Users global-role updates to super_admin or member", () => {
    expect(adminUserUpdateSchema.safeParse({ role: "super_admin" }).success).toBe(true);
    expect(adminUserUpdateSchema.safeParse({ role: "member" }).success).toBe(true);
    expect(adminUserUpdateSchema.safeParse({ role: "reviewer" }).success).toBe(false);
    expect(adminUserUpdateSchema.safeParse({ role: "team_admin" }).success).toBe(false);
    expect(adminUserUpdateSchema.safeParse({ role: "organization_owner" }).success).toBe(false);
  });

  it("grants user management and audit permissions to super_admin", () => {
    expect(can("super_admin", "user:read:any")).toBe(true);
    expect(can("super_admin", "user:manage-roles")).toBe(true);
    expect(can("super_admin", "audit:read")).toBe(true);
  });

  it("does not grant platform-admin permissions to organization_owner or team_admin", () => {
    // organization_owner / team_admin are global-role ranks that predate the
    // per-organization role system (org-rbac.ts). Being an org's owner or
    // team admin must never imply platform-wide Admin Center access.
    expect(can("organization_owner", "user:manage-roles")).toBe(false);
    expect(can("organization_owner", "user:read:any")).toBe(false);
    expect(can("organization_owner", "audit:read")).toBe(false);
    expect(can("team_admin", "user:manage-roles")).toBe(false);
    expect(can("team_admin", "user:read:any")).toBe(false);
    expect(can("team_admin", "audit:read")).toBe(false);
  });

  it("denies user manage roles to standard teacher and student", () => {
    expect(can("teacher", "user:manage-roles")).toBe(false);
    expect(can("teacher", "user:read:any")).toBe(false);
    expect(can("student", "user:manage-roles")).toBe(false);
    expect(can("student", "user:read:any")).toBe(false);
  });

  it("only super_admin can reach the Admin Center gate", () => {
    const adminGate = ["user:read:any", "user:manage-roles", "audit:read"] as const;
    expect(canAny("super_admin", adminGate)).toBe(true);
    expect(canAny("organization_owner", adminGate)).toBe(false);
    expect(canAny("team_admin", adminGate)).toBe(false);
    expect(canAny("moderator", adminGate)).toBe(false);
    expect(canAny("student", adminGate)).toBe(false);
  });
});

describe("Super Admin Retention Invariant (At least one active superadmin remain)", () => {
  it("prevents demoting the last active super_admin", () => {
    const check = validateSuperAdminRetention({
      currentRole: "super_admin",
      currentStatus: "active",
      newRole: "member",
      otherActiveSuperAdminCount: 0,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/Cannot demote or deactivate the last active Super Admin/i);
  });

  it("prevents suspending the last active super_admin", () => {
    const check = validateSuperAdminRetention({
      currentRole: "super_admin",
      currentStatus: "active",
      newStatus: "suspended",
      otherActiveSuperAdminCount: 0,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/Cannot demote or deactivate the last active Super Admin/i);
  });

  it("prevents setting the last active super_admin to pending", () => {
    const check = validateSuperAdminRetention({
      currentRole: "super_admin",
      currentStatus: "active",
      newStatus: "pending",
      otherActiveSuperAdminCount: 0,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/Cannot demote or deactivate the last active Super Admin/i);
  });

  it("prevents demoting an already suspended super_admin if they are the only super_admin record", () => {
    const check = validateSuperAdminRetention({
      currentRole: "super_admin",
      currentStatus: "suspended",
      newRole: "member",
      otherActiveSuperAdminCount: 0,
      otherSuperAdminCount: 0,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/Cannot demote the last Super Admin/i);
  });

  it("allows demoting or suspending an active super_admin when another active super_admin remains", () => {
    const demoteCheck = validateSuperAdminRetention({
      currentRole: "super_admin",
      currentStatus: "active",
      newRole: "member",
      otherActiveSuperAdminCount: 1,
    });
    expect(demoteCheck.allowed).toBe(true);

    const suspendCheck = validateSuperAdminRetention({
      currentRole: "super_admin",
      currentStatus: "active",
      newStatus: "suspended",
      otherActiveSuperAdminCount: 1,
    });
    expect(suspendCheck.allowed).toBe(true);
  });

  it("allows non-super_admin updates regardless of super_admin count", () => {
    const check = validateSuperAdminRetention({
      currentRole: "member",
      currentStatus: "active",
      newRole: "super_admin",
      otherActiveSuperAdminCount: 0,
    });
    expect(check.allowed).toBe(true);

    const checkSuspendMember = validateSuperAdminRetention({
      currentRole: "member",
      currentStatus: "active",
      newStatus: "suspended",
      otherActiveSuperAdminCount: 0,
    });
    expect(checkSuspendMember.allowed).toBe(true);
  });

  it("allows keeping super_admin active without changes", () => {
    const check = validateSuperAdminRetention({
      currentRole: "super_admin",
      currentStatus: "active",
      newRole: "super_admin",
      newStatus: "active",
      otherActiveSuperAdminCount: 0,
    });
    expect(check.allowed).toBe(true);
  });
});

describe("Self-Account Modification Invariant (Prevent self-suspension and self-demotion)", () => {
  it("prevents an administrator from suspending their own account", () => {
    const check = validateSelfAccountModification({
      actorId: "user-123",
      targetUserId: "user-123",
      currentStatus: "active",
      currentRole: "super_admin",
      newStatus: "suspended",
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/cannot suspend or change the account status of your own account/i);
  });

  it("prevents an administrator from demoting their own role", () => {
    const check = validateSelfAccountModification({
      actorId: "user-123",
      targetUserId: "user-123",
      currentStatus: "active",
      currentRole: "super_admin",
      newRole: "member",
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toMatch(/cannot change or demote the global role of your own account/i);
  });

  it("allows updating another user's status or role", () => {
    const check = validateSelfAccountModification({
      actorId: "user-admin",
      targetUserId: "user-other",
      currentStatus: "active",
      currentRole: "member",
      newStatus: "suspended",
    });
    expect(check.allowed).toBe(true);
  });

  it("allows an administrator to update their own organization/org-role without changing global role or status", () => {
    const check = validateSelfAccountModification({
      actorId: "user-123",
      targetUserId: "user-123",
      currentStatus: "active",
      currentRole: "super_admin",
      newStatus: "active",
      newRole: "super_admin",
    });
    expect(check.allowed).toBe(true);
  });
});

