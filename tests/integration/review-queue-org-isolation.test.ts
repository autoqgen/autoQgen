import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";
import type { GeneratePaperInput } from "@/lib/validation/paper.schema";

/**
 * Review Queue — organization isolation, end to end.
 *
 * Traces the real flow: questionService.list (queue load) → questionService.update
 * / bulkUpdateStatus (the review action) → paperGeneratorService (eligibility).
 * Every step must be scoped to the caller's current organization (for a
 * super_admin, the one selected in their context) and must never touch, reveal
 * or mutate another organization's questions.
 */
const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

function actorFor(id: Types.ObjectId, role: UserRole, organizationId: string | null): AuthContext {
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

interface Tax {
  orgId: Types.ObjectId;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  topic: Types.ObjectId;
}

async function seedOrg(slug: string): Promise<Tax> {
  const { Organization, Category, Subject, Chapter, Topic } = await import("@/models");
  const org = await Organization.create({ name: slug, slug, isActive: true });
  const category = await Category.create({ organizationId: org._id, name: `${slug} Cat`, slug: `${slug}-cat` });
  const subject = await Subject.create({
    organizationId: org._id,
    name: `${slug} Sub`,
    slug: `${slug}-sub`,
    category: category._id,
  });
  const chapter = await Chapter.create({
    organizationId: org._id,
    name: `${slug} Chap`,
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

async function mkQuestion(
  tax: Tax,
  creator: Types.ObjectId,
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED",
  text: string,
  chapter?: Types.ObjectId,
): Promise<Types.ObjectId> {
  const { Question } = await import("@/models");
  const { questionContentHash } = await import("@/lib/security/hash");
  const chapId = chapter ?? tax.chapter;
  const doc = await Question.create({
    organizationId: tax.orgId,
    category: tax.category,
    subject: tax.subject,
    chapter: chapId,
    topic: tax.topic,
    type: "MCQ",
    difficulty: "EASY",
    language: "en",
    question: { text },
    options: [
      { id: "A", text: "Newton" },
      { id: "B", text: "Joule" },
    ],
    answer: { text: "", correctOptions: ["A"], booleanAnswer: null, matchingPairs: [] },
    contentHash: questionContentHash(chapId.toString(), text),
    marks: 1,
    status,
    isActive: true,
    createdBy: creator,
  });
  return doc._id;
}

const listQuery = (status?: string) => ({
  page: 1,
  limit: 50,
  sort: "newest" as const,
  search: undefined,
  tags: undefined,
  mine: undefined,
  aiGenerated: undefined,
  withAnswers: undefined,
  ...(status ? { status: status as "PENDING" | "APPROVED" | "DRAFT" | "REJECTED" } : {}),
});

function genSpec(tax: Tax, overrides: Partial<GeneratePaperInput> = {}): GeneratePaperInput {
  return {
    category: tax.category.toString(),
    subject: tax.subject.toString(),
    chapters: [tax.chapter.toString()],
    topics: [],
    board: null,
    exam: null,
    year: null,
    language: null,
    totalQuestions: 5,
    totalMarks: null,
    difficultyDistribution: [],
    typeDistribution: [],
    status: "APPROVED",
    ...overrides,
  } as GeneratePaperInput;
}

describe.skipIf(!available)("review queue — organization isolation", () => {
  async function setup() {
    const { User } = await import("@/models");
    const a = await seedOrg("alpha");
    const b = await seedOrg("beta");

    const reviewerA = await User.create({ name: "Reviewer A", email: "ra@example.com", password: "x", role: "reviewer" });
    const reviewerB = await User.create({ name: "Reviewer B", email: "rb@example.com", password: "x", role: "reviewer" });
    const admin = await User.create({ name: "Admin", email: "admin@example.com", password: "x", role: "super_admin" });

    const { OrganizationMember } = await import("@/models");
    await OrganizationMember.create({ userId: reviewerA._id, organizationId: a.orgId, role: "reviewer", status: "active" });
    await OrganizationMember.create({ userId: reviewerB._id, organizationId: b.orgId, role: "reviewer", status: "active" });

    // A: 3 pending, 1 draft, 1 rejected. B: 2 pending.
    const aPending = [
      await mkQuestion(a, reviewerA._id, "PENDING", "A pending one"),
      await mkQuestion(a, reviewerA._id, "PENDING", "A pending two"),
      await mkQuestion(a, reviewerA._id, "PENDING", "A pending three"),
    ];
    const aDraft = await mkQuestion(a, reviewerA._id, "DRAFT", "A draft");
    await mkQuestion(a, reviewerA._id, "REJECTED", "A rejected");
    const bPending = [
      await mkQuestion(b, reviewerB._id, "PENDING", "B pending one"),
      await mkQuestion(b, reviewerB._id, "PENDING", "B pending two"),
    ];

    return { a, b, reviewerA, reviewerB, admin, aPending, aDraft, bPending };
  }

  it("Org A reviewer sees only A's pending questions; Org B reviewer sees only B's", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { a, b, reviewerA, reviewerB, aPending, bPending } = await setup();

    const aIds = new Set(aPending.map((id) => id.toString()));
    const bIds = new Set(bPending.map((id) => id.toString()));

    const forA = await questionService.list(listQuery("PENDING"), actorFor(reviewerA._id, "reviewer", a.orgId.toString()));
    expect(forA.total).toBe(3);
    expect(forA.items.every((q) => q.status === "PENDING")).toBe(true);
    expect(new Set(forA.items.map((q) => q._id!.toString()))).toEqual(aIds);
    expect(forA.items.some((q) => bIds.has(q._id!.toString()))).toBe(false);

    const forB = await questionService.list(listQuery("PENDING"), actorFor(reviewerB._id, "reviewer", b.orgId.toString()));
    expect(forB.total).toBe(2);
    expect(new Set(forB.items.map((q) => q._id!.toString()))).toEqual(bIds);
    expect(forB.items.some((q) => aIds.has(q._id!.toString()))).toBe(false);
  });

  it("Org A reviewer cannot approve or reject a B question by supplying its id", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question } = await import("@/models");
    const { a, reviewerA, bPending } = await setup();
    const actor = actorFor(reviewerA._id, "reviewer", a.orgId.toString());

    await expect(questionService.update(bPending[0]!.toString(), { status: "APPROVED", reviewNote: "" }, actor)).rejects.toThrow();
    await expect(questionService.update(bPending[1]!.toString(), { status: "REJECTED", reviewNote: "" }, actor)).rejects.toThrow();

    const bulk = await questionService.bulkUpdateStatus(
      bPending.map((id) => id.toString()),
      "APPROVED",
      undefined,
      actor,
    );
    expect(bulk.updated).toBe(0);
    expect(bulk.skipped).toHaveLength(2);

    const stillPending = await Question.find({ _id: { $in: bPending } }).select("status organizationId").lean().exec();
    expect(stillPending.every((q) => q.status === "PENDING")).toBe(true);
  });

  it("keeps a cross-org question's organizationId unchanged after a blocked review", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question } = await import("@/models");
    const { a, b, reviewerA, bPending } = await setup();
    const actor = actorFor(reviewerA._id, "reviewer", a.orgId.toString());

    await questionService.update(bPending[0]!.toString(), { status: "APPROVED", reviewNote: "" }, actor).catch(() => undefined);

    const q = await Question.findById(bPending[0]).select("organizationId status").lean().exec();
    expect(q?.organizationId.toString()).toBe(b.orgId.toString());
    expect(q?.status).toBe("PENDING");
  });

  it("Super Admin reviews only the organization selected in their context", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { a, b, admin, aPending, bPending } = await setup();

    const aIds = new Set(aPending.map((id) => id.toString()));
    const bIds = new Set(bPending.map((id) => id.toString()));

    const inA = await questionService.list(listQuery("PENDING"), actorFor(admin._id, "super_admin", a.orgId.toString()));
    expect(inA.total).toBe(3);
    expect(new Set(inA.items.map((q) => q._id!.toString()))).toEqual(aIds);
    expect(inA.items.some((q) => bIds.has(q._id!.toString()))).toBe(false);

    const inB = await questionService.list(listQuery("PENDING"), actorFor(admin._id, "super_admin", b.orgId.toString()));
    expect(inB.total).toBe(2);
    expect(new Set(inB.items.map((q) => q._id!.toString()))).toEqual(bIds);
    expect(inB.items.some((q) => aIds.has(q._id!.toString()))).toBe(false);
  });

  it("Super Admin with no selected organization cannot load or action the queue", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { admin, aPending } = await setup();
    const noOrg = actorFor(admin._id, "super_admin", null);

    const listed = await questionService.list(listQuery("PENDING"), noOrg);
    expect(listed).toEqual({ items: [], total: 0 });

    await expect(questionService.update(aPending[0]!.toString(), { status: "APPROVED", reviewNote: "" }, noOrg)).rejects.toThrow(/organization/i);
    await expect(
      questionService.bulkUpdateStatus([aPending[0]!.toString()], "APPROVED", undefined, noOrg),
    ).rejects.toThrow(/organization/i);
  });

  it("approved and rejected questions leave the pending queue; organizationId is preserved", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question } = await import("@/models");
    const { a, reviewerA, aPending } = await setup();
    const actor = actorFor(reviewerA._id, "reviewer", a.orgId.toString());

    await questionService.update(aPending[0]!.toString(), { status: "APPROVED", reviewNote: "" }, actor);
    await questionService.update(aPending[1]!.toString(), { status: "REJECTED", reviewNote: "" }, actor);

    const pending = await questionService.list(listQuery("PENDING"), actor);
    expect(pending.total).toBe(1);
    expect(pending.items[0]?._id?.toString()).toBe(aPending[2]!.toString());

    const approved = await questionService.list(listQuery("APPROVED"), actor);
    expect(approved.items.map((q) => q._id?.toString())).toContain(aPending[0]!.toString());

    const moved = await Question.find({ _id: { $in: [aPending[0]!, aPending[1]!] } })
      .select("status organizationId")
      .lean()
      .exec();
    expect(moved.find((q) => q._id.toString() === aPending[0]!.toString())?.status).toBe("APPROVED");
    expect(moved.find((q) => q._id.toString() === aPending[1]!.toString())?.status).toBe("REJECTED");
    expect(moved.every((q) => q.organizationId.toString() === a.orgId.toString())).toBe(true);
  });

  it("bulk approves mixed draft and pending questions within the selected organization", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question } = await import("@/models");
    const { a, reviewerA, aPending, aDraft } = await setup();
    const actor = actorFor(reviewerA._id, "reviewer", a.orgId.toString());

    const result = await questionService.bulkUpdateStatus(
      [aDraft.toString(), aPending[0]!.toString()],
      "APPROVED",
      undefined,
      actor,
    );

    expect(result).toMatchObject({ requested: 2, updated: 2, skipped: [] });
    const pendingId = aPending[0];
    expect(pendingId).toBeDefined();
    const approved = await Question.find({
      _id: { $in: [aDraft, pendingId!] },
    }).select("status organizationId").lean().exec();
    expect(approved.every((question) => question.status === "APPROVED")).toBe(true);
    expect(approved.every((question) => question.organizationId.toString() === a.orgId.toString())).toBe(true);
  });

  it("only APPROVED questions become eligible for paper generation, scoped to the org", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const { a, reviewerA, aPending, bPending } = await setup();
    const actor = actorFor(reviewerA._id, "reviewer", a.orgId.toString());

    // Nothing approved yet in A → generator finds no pool.
    await expect(paperGeneratorService.generate(genSpec(a, { totalQuestions: 2 }), a.orgId.toString())).rejects.toThrow(
      /no approved questions/i,
    );

    // Approve two of A's pending questions.
    await questionService.update(aPending[0]!.toString(), { status: "APPROVED", reviewNote: "" }, actor);
    await questionService.update(aPending[1]!.toString(), { status: "APPROVED", reviewNote: "" }, actor);

    const result = await paperGeneratorService.generate(genSpec(a, { totalQuestions: 2 }), a.orgId.toString());
    const ids = result.questions.map((q) => q.id);
    expect(ids.length).toBe(2);
    expect(new Set(ids)).toEqual(new Set([aPending[0]!.toString(), aPending[1]!.toString()]));

    // None of B's questions can ever surface for A.
    expect(ids.some((id) => bPending.map((x) => x.toString()).includes(id))).toBe(false);
  });

  it("a forced non-approved status in the generation spec still yields only APPROVED questions", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const { a, reviewerA, aPending } = await setup();
    const actor = actorFor(reviewerA._id, "reviewer", a.orgId.toString());

    await questionService.update(aPending[0]!.toString(), { status: "APPROVED", reviewNote: "" }, actor);

    // Craft a spec that tries to widen the pool to PENDING — the generator must
    // ignore it and draw only from the single APPROVED question.
    const forced = genSpec(a, { totalQuestions: 1, status: "PENDING" as unknown as "APPROVED" });
    const result = await paperGeneratorService.generate(forced, a.orgId.toString());

    expect(result.questions.map((q) => q.id)).toEqual([aPending[0]!.toString()]);
    // The two still-pending A questions were not pulled in.
    expect(result.questions.length).toBe(1);
  });

  it("an organization owner can clear the whole queue in one bulk action, drafts included", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question, User, OrganizationMember } = await import("@/models");
    const { a, b, reviewerA, aPending } = await setup();

    const owner = await User.create({
      name: "Owner A",
      email: "owner-a@example.com",
      password: "x",
      role: "organization_owner",
    });
    await OrganizationMember.create({
      userId: owner._id,
      organizationId: a.orgId,
      role: "organization_owner",
      status: "active",
    });
    const ownerCtx = actorFor(owner._id, "organization_owner", a.orgId.toString());

    const draftA = await mkQuestion(a, owner._id, "DRAFT", "A draft awaiting owner");
    const draftB = await mkQuestion(b, owner._id, "DRAFT", "B draft — off limits");

    // A reviewer can move a draft straight to APPROVED.
    const reviewerApproval = await questionService.update(
      draftA.toString(),
      { status: "APPROVED", reviewNote: "" },
      actorFor(reviewerA._id, "reviewer", a.orgId.toString()),
    );
    expect(reviewerApproval.status).toBe("APPROVED");

    // The owner can — single item.
    const single = await questionService.update(draftA.toString(), { status: "APPROVED", reviewNote: "" }, ownerCtx);
    expect(single.status).toBe("APPROVED");

    // …and in bulk, mixing drafts and pending, in one call ("select all").
    const bulk = await questionService.bulkUpdateStatus(
      [...aPending.map((id) => id.toString()), (await mkQuestion(a, owner._id, "DRAFT", "another A draft")).toString()],
      "APPROVED",
      undefined,
      ownerCtx,
    );
    expect(bulk.skipped).toHaveLength(0);
    expect(bulk.updated).toBe(4);

    // Organization scope still holds — B's draft is untouched and unreachable.
    await expect(
      questionService.update(draftB.toString(), { status: "APPROVED", reviewNote: "" }, ownerCtx),
    ).rejects.toThrow();
    const bDoc = await Question.findById(draftB).select("status organizationId").lean().exec();
    expect(bDoc?.status).toBe("DRAFT");
    expect(bDoc?.organizationId.toString()).toBe(b.orgId.toString());

    // Every A question moved is still an A question.
    const movedA = await Question.find({ organizationId: a.orgId, status: "APPROVED" }).countDocuments();
    expect(movedA).toBe(5);
  });
});
