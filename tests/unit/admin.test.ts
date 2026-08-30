import { describe, expect, it } from "vitest";
import { can, canAny } from "@/lib/auth/rbac";

describe("Admin RBAC Permissions", () => {
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
