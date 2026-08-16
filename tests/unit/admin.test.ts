import { describe, expect, it } from "vitest";
import { can, canAny } from "@/lib/auth/rbac";

describe("Admin RBAC Permissions", () => {
  it("grants user management and audit permissions to super_admin", () => {
    expect(can("super_admin", "user:read:any")).toBe(true);
    expect(can("super_admin", "user:manage-roles")).toBe(true);
    expect(can("super_admin", "audit:read")).toBe(true);
  });

  it("grants user manage roles to organization_owner", () => {
    expect(can("organization_owner", "user:manage-roles")).toBe(true);
    expect(can("organization_owner", "user:read:any")).toBe(true);
  });

  it("denies user manage roles to standard teacher and student", () => {
    expect(can("teacher", "user:manage-roles")).toBe(false);
    expect(can("teacher", "user:read:any")).toBe(false);
    expect(can("student", "user:manage-roles")).toBe(false);
    expect(can("student", "user:read:any")).toBe(false);
  });

  it("correctly identifies admin roles via canAny", () => {
    expect(canAny("super_admin", ["user:read:any", "user:manage-roles"])).toBe(true);
    expect(canAny("team_admin", ["user:read:any", "user:manage-roles"])).toBe(true);
    expect(canAny("student", ["user:read:any", "user:manage-roles"])).toBe(false);
  });
});
