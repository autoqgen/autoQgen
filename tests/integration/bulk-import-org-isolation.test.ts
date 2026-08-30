import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";
import type { BulkImportQuestionInput } from "@/lib/validation/question.schema";

/**
 * Bulk question import must never cross the organization boundary:
 *
 *  - the target organization is resolved from the caller's AuthContext
 *    (their current organization; for a super_admin, the one they selected),
 *    never from the request body;
 *  - a row that references another organization's taxonomy is rejected;
 *  - a client-supplied `organizationId` on a row is ignored.
 *
 * See the harness note in organization-service.test.ts for why `available`
 * is resolved with top-level await rather than in beforeAll.
 */
const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

function actorFor(
  id: Types.ObjectId,
  role: UserRole,
  organizationId: string | null,
): AuthContext {
  return {
    id: id.toString(),
    objectId: id,
    email: `${role}-${id.toString()}@example.com`,
    name: role,
    role,
    status: "active",
    organizationId,
  };
}

interface OrgTaxonomy {
  orgId: Types.ObjectId;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  topic: Types.ObjectId;
}

async function seedOrg(slug: string): Promise<OrgTaxonomy> {
  const { Organization, Category, Subject, Chapter, Topic } = await import("@/models");

  const org = await Organization.create({ name: slug, slug, isActive: true });
  const category = await Category.create({
    organizationId: org._id,
    name: `${slug} Category`,
    slug: `${slug}-cat`,
  });
  const subject = await Subject.create({
    organizationId: org._id,
    name: `${slug} Subject`,
    slug: `${slug}-sub`,
    category: category._id,
  });
  const chapter = await Chapter.create({
    organizationId: org._id,
    name: `${slug} Chapter`,
    slug: `${slug}-chap`,
    category: category._id,
    subject: subject._id,
  });
  const topic = await Topic.create({
    organizationId: org._id,
    name: `${slug} Topic`,
    slug: `${slug}-topic`,
    category: category._id,
    subject: subject._id,
    chapter: chapter._id,
  });

  return { orgId: org._id, category: category._id, subject: subject._id, chapter: chapter._id, topic: topic._id };
}

async function addMember(
  userId: Types.ObjectId,
  organizationId: Types.ObjectId,
  role: "organization_owner" | "team_admin" | "teacher" = "team_admin",
): Promise<void> {
  const { OrganizationMember } = await import("@/models");
  await OrganizationMember.create({ userId, organizationId, role, status: "active" });
}

function row(
  tax: OrgTaxonomy,
  text: string,
  overrides: Partial<BulkImportQuestionInput> = {},
): BulkImportQuestionInput {
  return {
    category: tax.category.toString(),
    subject: tax.subject.toString(),
    chapter: tax.chapter.toString(),
    topic: tax.topic.toString(),
    board: null,
    exam: null,
    type: "MCQ",
    difficulty: "EASY",
    language: "en",
    question: { text, image: "", audio: "", video: "", passage: "", latex: "" },
    options: [
      { id: "A", text: "Newton", image: "", explanation: "" },
      { id: "B", text: "Joule", image: "", explanation: "" },
    ],
    answer: { text: "", correctOptions: ["A"], booleanAnswer: null, matchingPairs: [] },
    explanation: "",
    source: "",
    session: "",
    year: null,
    marks: 1,
    estimatedTime: 60,
    tags: [],
    aiGenerated: false,
    status: "DRAFT",
    ...overrides,
  } as BulkImportQuestionInput;
}

describe.skipIf(!available)("bulk import — organization isolation", () => {
  it("imports only into the caller's own organization", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question, User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    await seedOrg("beta");
    const importer = await User.create({ name: "Importer", email: "importer@example.com", password: "x", role: "team_admin" });
    await addMember(importer._id, orgA.orgId);

    const actor = actorFor(importer._id, "team_admin", orgA.orgId.toString());
    const result = await questionService.bulkCreate(
      [row(orgA, "Alpha question one"), row(orgA, "Alpha question two")],
      actor,
    );

    expect(result.inserted).toBe(2);
    expect(result.failed).toBe(0);

    const stored = await Question.find({}).select("organizationId").lean().exec();
    expect(stored).toHaveLength(2);
    expect(stored.every((q) => q.organizationId.toString() === orgA.orgId.toString())).toBe(true);
  });

  it("rejects rows that reference another organization's taxonomy", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question, User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const orgB = await seedOrg("beta");
    const importer = await User.create({ name: "Importer", email: "importer@example.com", password: "x", role: "team_admin" });
    await addMember(importer._id, orgA.orgId);

    const actor = actorFor(importer._id, "team_admin", orgA.orgId.toString());

    // One clean row, one whose chapter/subject belong to organization B.
    const crossRow = row(orgA, "Cross-tenant question", {
      subject: orgB.subject.toString(),
      chapter: orgB.chapter.toString(),
      topic: orgB.topic.toString(),
    });

    const result = await questionService.bulkCreate([row(orgA, "Alpha ok"), crossRow], actor);

    expect(result.inserted).toBe(1);
    expect(result.failed).toBe(1);
    expect(result.errors[0]?.index).toBe(1);
    expect(JSON.stringify(result.errors[0])).toMatch(/does not exist/i);

    // Nothing was written under organization B.
    expect(await Question.countDocuments({ organizationId: orgB.orgId })).toBe(0);
    expect(await Question.countDocuments({ organizationId: orgA.orgId })).toBe(1);
  });

  it("ignores a client-supplied organizationId on a row", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question, User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const orgB = await seedOrg("beta");
    const importer = await User.create({ name: "Importer", email: "importer@example.com", password: "x", role: "team_admin" });
    await addMember(importer._id, orgA.orgId);

    const actor = actorFor(importer._id, "team_admin", orgA.orgId.toString());

    // A crafted payload that smuggles in `organizationId` for organization B,
    // while every taxonomy reference is organization A's.
    const smuggled = {
      ...row(orgA, "Smuggled row"),
      organizationId: orgB.orgId.toString(),
    } as unknown as BulkImportQuestionInput;

    const result = await questionService.bulkCreate([smuggled], actor);
    expect(result.inserted).toBe(1);

    const stored = await Question.findOne({}).select("organizationId").lean().exec();
    expect(stored?.organizationId.toString()).toBe(orgA.orgId.toString());
    expect(await Question.countDocuments({ organizationId: orgB.orgId })).toBe(0);
  });

  it("ignores a forged AuthContext.organizationId the caller is not a member of", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question, User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const orgB = await seedOrg("beta");
    const importer = await User.create({ name: "Importer", email: "importer@example.com", password: "x", role: "team_admin" });
    await addMember(importer._id, orgA.orgId); // member of A only

    // Context claims organization B, but there is no membership there — resolution
    // must fall back to the caller's real (A) membership.
    const forged = actorFor(importer._id, "team_admin", orgB.orgId.toString());
    const result = await questionService.bulkCreate([row(orgA, "Still lands in A")], forged);

    expect(result.inserted).toBe(1);
    const stored = await Question.findOne({}).select("organizationId").lean().exec();
    expect(stored?.organizationId.toString()).toBe(orgA.orgId.toString());
  });

  it("rejects a super_admin with no selected organization", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const admin = await User.create({ name: "Admin", email: "admin@example.com", password: "x", role: "super_admin" });

    await expect(
      questionService.bulkCreate([row(orgA, "no context")], actorFor(admin._id, "super_admin", null)),
    ).rejects.toThrow(/organization/i);
  });

  it("lets a super_admin import into the organization they have selected, and only that one", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question, User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const orgB = await seedOrg("beta");
    const admin = await User.create({ name: "Admin", email: "admin@example.com", password: "x", role: "super_admin" });

    // Selected context = organization B.
    const inB = actorFor(admin._id, "super_admin", orgB.orgId.toString());

    const ok = await questionService.bulkCreate([row(orgB, "Beta via super admin")], inB);
    expect(ok.inserted).toBe(1);

    const stored = await Question.findOne({}).select("organizationId").lean().exec();
    expect(stored?.organizationId.toString()).toBe(orgB.orgId.toString());

    // Same super admin, still in B context, but the row points at A's taxonomy → rejected.
    const crossed = await questionService.bulkCreate([row(orgA, "Alpha taxonomy from B context")], inB);
    expect(crossed.inserted).toBe(0);
    expect(crossed.failed).toBe(1);
    expect(await Question.countDocuments({ organizationId: orgA.orgId })).toBe(0);

    // And a smuggled organizationId=A on the row is still overridden by the B context.
    const smuggled = {
      ...row(orgB, "Beta row with smuggled A id"),
      organizationId: orgA.orgId.toString(),
    } as unknown as BulkImportQuestionInput;
    const smuggledResult = await questionService.bulkCreate([smuggled], inB);
    expect(smuggledResult.inserted).toBe(1);
    expect(await Question.countDocuments({ organizationId: orgB.orgId })).toBe(2);
    expect(await Question.countDocuments({ organizationId: orgA.orgId })).toBe(0);
  });
});
