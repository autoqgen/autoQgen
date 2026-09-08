import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { AuditContext } from "@/lib/services/audit.service";
import type { GeneratePaperInput } from "@/lib/validation/paper.schema";

/**
 * Smart question generation: usage tracking, previous-question controls,
 * recent-paper exclusion, mandatory / excluded lists, best-match flexibility —
 * all strictly organization-scoped.
 *
 * See organization-service.test.ts for why `available` is a top-level await.
 */
const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

function actorFor(id: Types.ObjectId, organizationId: string): AuthContext {
  return {
    id: id.toString(),
    objectId: id,
    email: `teacher-${id.toString()}@example.com`,
    name: "teacher",
    role: "teacher",
    status: "active",
    organizationId,
  };
}

const audit: AuditContext = { actor: null, requestId: "test", ip: "127.0.0.1" };

interface OrgFixture {
  org: Types.ObjectId;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  teacher: Types.ObjectId;
  actor: AuthContext;
  questionIds: string[];
}

/** Creates an organization with `count` approved questions (difficulty cycles E/M/H). */
async function seedOrg(slug: string, count: number): Promise<OrgFixture> {
  const { Organization, OrganizationMember, Category, Subject, Chapter, User, Question } =
    await import("@/models");
  const { questionContentHash } = await import("@/lib/security/hash");

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
  const teacher = await User.create({
    name: `${slug} teacher`,
    email: `${slug}-teacher@example.com`,
    password: "x",
    role: "teacher",
    organization: org._id,
  });
  await OrganizationMember.create({
    userId: teacher._id,
    organizationId: org._id,
    role: "teacher",
    status: "active",
  });

  const difficulties = ["EASY", "MEDIUM", "HARD"] as const;
  const questionIds: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = `${slug} question ${i}`;
    const q = await Question.create({
      organizationId: org._id,
      category: category._id,
      subject: subject._id,
      chapter: chapter._id,
      type: "MCQ",
      difficulty: difficulties[i % 3],
      language: "en",
      question: { text },
      options: [
        { id: "A", text: "one" },
        { id: "B", text: "two" },
      ],
      answer: { text: "", correctOptions: ["A"], booleanAnswer: null, matchingPairs: [] },
      contentHash: questionContentHash(chapter._id.toString(), text),
      marks: 1,
      status: "APPROVED",
      isActive: true,
      createdBy: teacher._id,
    });
    questionIds.push(q._id.toString());
  }

  return {
    org: org._id,
    category: category._id,
    subject: subject._id,
    chapter: chapter._id,
    teacher: teacher._id,
    actor: actorFor(teacher._id, org._id.toString()),
    questionIds,
  };
}

function spec(f: OrgFixture, overrides: Partial<GeneratePaperInput> = {}): GeneratePaperInput {
  return {
    organizationId: null,
    category: f.category.toString(),
    subject: f.subject.toString(),
    chapters: [f.chapter.toString()],
    topics: [],
    board: null,
    exam: null,
    year: null,
    language: null,
    totalQuestions: 5,
    totalMarks: null,
    difficultyDistribution: [],
    typeDistribution: [],
    chapterDistribution: [],
    previousQuestions: { mode: "allow", percent: 100, paperRange: 0 },
    excludeRecentPapers: 0,
    mandatoryQuestionIds: [],
    excludedQuestionIds: [],
    randomize: { selection: true, order: true, options: true },
    status: "APPROVED",
    ...overrides,
  };
}

async function generateSaved(
  f: OrgFixture,
  overrides: Partial<GeneratePaperInput> = {},
  title = "Paper",
  paperType: "MODEL_TEST" | "EXAM" | "PRACTICE_TEST" | "ASSIGNMENT" | "OTHER" = "OTHER",
) {
  const { paperService } = await import("@/lib/services/paper.service");
  return paperService.generateAndSave(
    { title, description: "", instructions: "", durationMinutes: null, paperType, spec: spec(f, overrides) },
    f.actor,
    audit,
  );
}

describe.skipIf(!available)("smart question generation", () => {
  it("records question usage, scoped to the paper's organization", async () => {
    const { QuestionUsage } = await import("@/models");
    const a = await seedOrg("alpha", 12);
    await seedOrg("beta", 12);

    const { paper } = await generateSaved(a, { totalQuestions: 6 }, "Alpha model test", "MODEL_TEST");

    const rows = await QuestionUsage.find({}).lean().exec();
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.organizationId.toString() === a.org.toString())).toBe(true);
    expect(rows.every((r) => r.questionPaperId.toString() === paper._id.toString())).toBe(true);
    expect(rows.every((r) => r.paperType === "MODEL_TEST")).toBe(true);
  });

  it("usage history never counts another organization's papers", async () => {
    const { questionUsageRepository } = await import("@/lib/repositories/question-usage.repo");
    const a = await seedOrg("alpha", 12);
    const b = await seedOrg("beta", 12);

    await generateSaved(a, { totalQuestions: 6 });

    // From organization B's point of view, none of A's questions have ever been used.
    const stats = await questionUsageRepository.statsForQuestions(b.org, a.questionIds);
    expect(stats.size).toBe(0);
    expect(await questionUsageRepository.recentPaperIds(b.org, 5)).toHaveLength(0);
  });

  it("never selects an excluded question and always includes a mandatory one", async () => {
    const a = await seedOrg("alpha", 12);
    const excluded = a.questionIds[0]!;
    const mandatory = a.questionIds[1]!;

    const { result } = await generateSaved(a, {
      totalQuestions: 5,
      excludedQuestionIds: [excluded],
      mandatoryQuestionIds: [mandatory],
    });

    const ids = result.questions.map((q) => q.id);
    expect(ids).toContain(mandatory);
    expect(ids).not.toContain(excluded);
    expect(ids).toHaveLength(5);
  });

  it("excludes questions used in the most recent N papers", async () => {
    const a = await seedOrg("alpha", 12);

    const first = await generateSaved(a, { totalQuestions: 6 }, "First");
    const usedFirst = new Set(first.result.questions.map((q) => q.id));

    const second = await generateSaved(a, { totalQuestions: 6, excludeRecentPapers: 1 }, "Second");
    const usedSecond = second.result.questions.map((q) => q.id);

    expect(usedSecond).toHaveLength(6);
    expect(usedSecond.some((id) => usedFirst.has(id))).toBe(false);
  });

  it("previous-question mode 'exclude' drops every already-used question", async () => {
    const a = await seedOrg("alpha", 12);

    const first = await generateSaved(a, { totalQuestions: 6 });
    const usedFirst = new Set(first.result.questions.map((q) => q.id));

    const second = await generateSaved(a, {
      totalQuestions: 6,
      previousQuestions: { mode: "exclude", percent: 0, paperRange: 0 },
    });

    expect(second.result.questions.every((q) => !usedFirst.has(q.id))).toBe(true);
    expect(second.result.previousUsedCount).toBe(0);
  });

  it("previous-question mode 'allow' caps how many prior questions come back", async () => {
    const a = await seedOrg("alpha", 20);

    await generateSaved(a, { totalQuestions: 10 }); // now 10 questions have history

    const second = await generateSaved(a, {
      totalQuestions: 10,
      previousQuestions: { mode: "allow", percent: 20, paperRange: 0 },
    });

    expect(second.result.questions).toHaveLength(10);
    expect(second.result.previousUsedCount).toBeLessThanOrEqual(2);
    expect(second.result.previousAllowed).toBe(2);
  });

  it("meets the total by borrowing when a difficulty quota cannot be filled", async () => {
    // 15 questions => 5 EASY / 5 MEDIUM / 5 HARD.
    const a = await seedOrg("alpha", 15);

    const { result } = await generateSaved(a, {
      totalQuestions: 12,
      difficultyDistribution: [
        { difficulty: "EASY", count: 10 }, // only 5 exist
        { difficulty: "HARD", count: 2 },
      ],
    });

    expect(result.selected).toBe(12);
    expect(result.difficultyActual.EASY).toBeLessThanOrEqual(5);
    expect(result.warnings.some((w) => w.code === "DIFFICULTY_SHORTFALL")).toBe(true);
  });

  it("fails only when the organization has too few eligible questions", async () => {
    const a = await seedOrg("alpha", 4);
    await expect(generateSaved(a, { totalQuestions: 20 })).rejects.toThrow(/eligible question/i);
  });

  it("keeps generation inside the organization even with a super_admin actor override attempt", async () => {
    const a = await seedOrg("alpha", 10);
    const b = await seedOrg("beta", 10);
    const { Question } = await import("@/models");

    // Non-super actor: the spec.organizationId override is ignored, resolves to A.
    const { result } = await generateSaved(a, {
      totalQuestions: 8,
      organizationId: b.org.toString() as unknown as null,
    });

    const chosen = await Question.find({ _id: { $in: result.questions.map((q) => new Types.ObjectId(q.id)) } })
      .select("organizationId")
      .lean()
      .exec();
    expect(chosen).toHaveLength(8);
    expect(chosen.every((q) => q.organizationId.toString() === a.org.toString())).toBe(true);
  });
});
