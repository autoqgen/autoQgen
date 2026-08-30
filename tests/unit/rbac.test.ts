import { describe, expect, it } from "vitest";

import {
  can,
  canActOnResource,
  canExportAnswers,
  canReadAnswers,
  ROLE_PERMISSIONS,
} from "@/lib/auth/rbac";
import { USER_ROLES } from "@/types/roles";

describe("RBAC matrix", () => {
  it("defines a permission entry for every declared role", () => {
    for (const role of USER_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
      // "member" is the sole, deliberate exception: zero platform
      // permissions until a real role or org membership grants some.
      if (role === "member") {
        expect(ROLE_PERMISSIONS[role].length).toBe(0);
      } else {
        expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
      }
    }
  });

  it("gives a freshly registered member zero platform permissions", () => {
    expect(can("member", "question:read")).toBe(false);
    expect(can("member", "paper:create")).toBe(false);
    expect(can("member", "taxonomy:read")).toBe(false);
  });

  it("does not let a student create, review or bulk-import questions", () => {
    expect(can("student", "question:create")).toBe(false);
    expect(can("student", "question:review")).toBe(false);
    expect(can("student", "question:bulk-import")).toBe(false);
    expect(can("student", "taxonomy:create")).toBe(false);
    expect(can("student", "user:manage-roles")).toBe(false);
  });

  it("never exposes answer keys to a student", () => {
    expect(canReadAnswers("student")).toBe(false);
    expect(canReadAnswers("teacher")).toBe(true);
    expect(canReadAnswers("reviewer")).toBe(true);
    expect(canReadAnswers("super_admin")).toBe(true);
  });

  it("does not let a teacher manage roles or bulk-import", () => {
    expect(can("teacher", "user:manage-roles")).toBe(false);
    expect(can("teacher", "question:bulk-import")).toBe(false);
  });

  it("restricts a teacher to editing their own questions", () => {
    expect(canActOnResource("teacher", "update", "user-a", "user-a")).toBe(true);
    expect(canActOnResource("teacher", "update", "user-a", "user-b")).toBe(false);
    expect(canActOnResource("teacher", "delete", "user-a", "user-b")).toBe(false);
  });

  it("lets a reviewer edit any question but not delete another user's", () => {
    expect(canActOnResource("reviewer", "update", "user-a", "user-b")).toBe(true);
    expect(canActOnResource("reviewer", "delete", "user-a", "user-b")).toBe(false);
  });

  it("gives a moderator delete-any", () => {
    expect(canActOnResource("moderator", "delete", "user-a", "user-b")).toBe(true);
  });

  it("keeps question papers away from students", () => {
    expect(can("student", "paper:read")).toBe(false);
    expect(can("student", "paper:create")).toBe(false);
    expect(can("student", "paper:export")).toBe(false);
  });

  it("lets a content writer build papers but not export the answer key", () => {
    expect(can("content_writer", "paper:create")).toBe(true);
    expect(can("content_writer", "paper:export")).toBe(true);
    expect(can("content_writer", "paper:export-answers")).toBe(false);
    expect(canExportAnswers("content_writer")).toBe(false);
  });

  it("lets a teacher export the teacher copy", () => {
    expect(canExportAnswers("teacher")).toBe(true);
  });

  it("restricts publishing to moderators and above", () => {
    expect(can("teacher", "paper:publish")).toBe(false);
    expect(can("reviewer", "paper:publish")).toBe(false);
    expect(can("moderator", "paper:publish")).toBe(true);
    expect(can("super_admin", "paper:publish")).toBe(true);
  });

  it("applies ownership rules to papers as it does to questions", () => {
    expect(canActOnResource("teacher", "update", "a", "a", "paper")).toBe(true);
    expect(canActOnResource("teacher", "update", "a", "b", "paper")).toBe(false);
    expect(canActOnResource("reviewer", "update", "a", "b", "paper")).toBe(true);
    expect(canActOnResource("moderator", "delete", "a", "b", "paper")).toBe(true);
  });

  it("restricts the audit trail, and the rest of the Admin Center, to super_admin only", () => {
    expect(can("teacher", "audit:read")).toBe(false);
    expect(can("moderator", "audit:read")).toBe(false);
    expect(can("team_admin", "audit:read")).toBe(false);
    expect(can("organization_owner", "audit:read")).toBe(false);
    expect(can("super_admin", "audit:read")).toBe(true);
  });

  it("grants super_admin every permission", () => {
    expect(can("super_admin", "user:manage-roles")).toBe(true);
    expect(can("super_admin", "question:bulk-import")).toBe(true);
    expect(can("super_admin", "taxonomy:delete")).toBe(true);
  });
});
