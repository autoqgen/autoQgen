import { describe, expect, it } from "vitest";

import { canAnyInOrg, canInOrg, ORG_ROLE_PERMISSIONS } from "@/lib/auth/org-rbac";
import { ORG_ASSIGNABLE_BY_OWNER, ORG_ROLES } from "@/types/organization";

describe("Organization RBAC matrix", () => {
  it("defines a permission set for every declared org role", () => {
    for (const role of ORG_ROLES) {
      expect(ORG_ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it("excludes super_admin from assignable org roles", () => {
    expect(ORG_ROLES).not.toContain("super_admin");
    expect(ORG_ASSIGNABLE_BY_OWNER).not.toContain("super_admin");
  });

  it("excludes organization_owner from roles an owner may assign", () => {
    expect(ORG_ASSIGNABLE_BY_OWNER).not.toContain("organization_owner");
    expect(ORG_ASSIGNABLE_BY_OWNER).toContain("team_admin");
    expect(ORG_ASSIGNABLE_BY_OWNER).toContain("student");
  });

  it("gives organization_owner every org permission", () => {
    expect(canInOrg("organization_owner", "members:invite")).toBe(true);
    expect(canInOrg("organization_owner", "roles:assign")).toBe(true);
    expect(canInOrg("organization_owner", "teams:create")).toBe(true);
    expect(canInOrg("organization_owner", "invitations:manage")).toBe(true);
  });

  it("keeps team_admin scoped to their own team, not org-wide governance", () => {
    expect(canInOrg("team_admin", "team:read")).toBe(true);
    expect(canInOrg("team_admin", "team:update")).toBe(true);
    expect(canInOrg("team_admin", "team:members:manage")).toBe(true);
    expect(canInOrg("team_admin", "members:invite")).toBe(false);
    expect(canInOrg("team_admin", "members:remove")).toBe(false);
    expect(canInOrg("team_admin", "roles:assign")).toBe(false);
    expect(canInOrg("team_admin", "invitations:manage")).toBe(false);
    expect(canInOrg("team_admin", "teams:create")).toBe(false);
  });

  it("gives ordinary members zero governance permissions, but baseline content capability", () => {
    for (const role of ["teacher", "content_writer", "reviewer", "moderator", "student", "member"] as const) {
      expect(canAnyInOrg(role, ["members:read", "teams:read", "organization:update", "roles:assign"])).toBe(
        false,
      );
      // An active membership, regardless of which of these roles it is, unlocks
      // baseline content capability — see org-rbac.ts's ORDINARY_MEMBER comment.
      expect(canInOrg(role, "question:read")).toBe(true);
      expect(canInOrg(role, "paper:create")).toBe(true);
    }
  });

  it("gives only organization teachers the question-authoring capabilities", () => {
    for (const permission of ["question:create", "question:generate-ai", "question:import"] as const) {
      expect(canInOrg("teacher", permission)).toBe(true);
      expect(canInOrg("member", permission)).toBe(false);
      expect(canInOrg("student", permission)).toBe(false);
    }
  });

  it("allows organization paper authors to export teacher and student copies", () => {
    for (const role of ["organization_owner", "team_admin", "teacher"] as const) {
      expect(canInOrg(role, "paper:export")).toBe(true);
      expect(canInOrg(role, "paper:export-answers")).toBe(true);
    }
  });

  it("lets an owner invite or assign someone as a plain org member", () => {
    expect(ORG_ASSIGNABLE_BY_OWNER).toContain("member");
  });
});
