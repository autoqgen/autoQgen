import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { AuditContext } from "@/lib/services/audit.service";
import type { GeneratePaperInput } from "@/lib/validation/paper.schema";

/**
 * Audit coverage for "previous question" business meaning:
 *
 *  - a finalized paper's questions become previously-used for that organization,
 *    regardless of paper type (Model Test / Exam / Practice Test / ...);
 *  - lookup is strictly organization-scoped;
 *  - editing a paper re-syncs its usage to the final question set;
 *  - a manually built paper records usage too;
 *  - deleting a paper clears its usage;
 *  - a regeneration lineage counts as ONE recent paper, not one per round.
 */

const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

const audit: AuditContext = { actor: null, requestId: "test", ip: "127.0.0.1" };

interface OrgFixture {
  org: Types.ObjectId;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  actor: AuthContext;
  questionIds: string[];
}

async function seedOrg(slug: string, count: number): Promise<OrgFixture> {
  const { Organization, OrganizationMember, Category, Subject, Chapter, User, Question } = await import("@/models");
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
  await OrganizationMember.create({ userId: teacher._id, organizationId: org._id, role: "teacher", status: "active" });

  const questionIds: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = `${slug} question ${i}`;
    const q = await Question.create({
      organizationId: org._id,
      category: category._id,
      subject: subject._id,
      chapter: chapter._id,
      type: "MCQ",
      difficulty: (["EASY", "MEDIUM", "HARD"] as const)[i % 3],
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
    actor: {
      id: teacher._id.toString(),
      objectId: teacher._id,
      email: `${slug}-teacher@example.com`,
      name: "teacher",
      role: "teacher",
      status: "active",
      organizationId: org._id.toString(),
    },
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
    randomize: { selection: true, order: false, options: false },
    status: "APPROVED",
    ...overrides,
  };
}

async function generateSaved(
  f: OrgFixture,
  overrides: Partial<GeneratePaperInput> = {},
  paperType: "MODEL_TEST" | "EXAM" | "PRACTICE_TEST" | "ASSIGNMENT" | "OTHER" = "MODEL_TEST",
) {
  const { paperService } = await import("@/lib/services/paper.service");
  const result = await paperService.generateAndSave(
    { title: `${paperType} paper`, description: "", instructions: "", durationMinutes: null, paperType, spec: spec(f, overrides) },
    f.actor,
    audit,
  );
  await paperService.setPreviousUsageDecision(result.paper._id.toString(), "confirmed", f.actor, audit);
  return result;
}

describe.skipIf(!available)("previous-question usage — audit", () => {
  it("records one persisted decision and only confirmed papers create usage", async () => {
    const { QuestionUsage } = await import("@/models");
    const { paperService } = await import("@/lib/services/paper.service");
    const f = await seedOrg("decision", 20);

    const declined = await paperService.generateAndSave(
      { title: "declined paper", description: "", instructions: "", durationMinutes: null, paperType: "MODEL_TEST", spec: spec(f) },
      f.actor,
      audit,
    );
    const declinedDecision = await paperService.setPreviousUsageDecision(
      declined.paper._id.toString(),
      "declined",
      f.actor,
      audit,
    );
    expect(declinedDecision.decision).toBe("declined");
    expect(await QuestionUsage.countDocuments({ questionPaperId: declined.paper._id })).toBe(0);

    const repeatedDecision = await paperService.setPreviousUsageDecision(
      declined.paper._id.toString(),
      "confirmed",
      f.actor,
      audit,
    );
    expect(repeatedDecision.decision).toBe("declined");
    expect(await QuestionUsage.countDocuments({ questionPaperId: declined.paper._id })).toBe(0);
  });

  it("Q1/Q4: a generated Model Test's questions become previously used for that org, only after persistence", async () => {
    const { QuestionUsage } = await import("@/models");
    const f = await seedOrg("alpha", 20);

    // Dry run (no persist) records nothing.
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    await paperGeneratorService.generate(spec(f, { totalQuestions: 5 }), f.org.toString());
    expect(await QuestionUsage.countDocuments({})).toBe(0);

    const p1 = await generateSaved(f, { totalQuestions: 5 });
    const used = await QuestionUsage.find({ organizationId: f.org }).lean().exec();
    expect(used).toHaveLength(5);
    expect(used.every((u) => u.questionPaperId.toString() === p1.paper._id.toString())).toBe(true);
    expect(new Set(used.map((u) => u.questionId.toString()))).toEqual(
      new Set(p1.result.questions.map((q) => q.id)),
    );
  });

  it("Q2: previous usage is recognised across paper types (Exam, Practice Test, ...)", async () => {
    const { questionUsageRepository } = await import("@/lib/repositories/question-usage.repo");
    const f = await seedOrg("alpha", 30);

    const exam = await generateSaved(f, { totalQuestions: 4 }, "EXAM");
    const practice = await generateSaved(
      f,
      { totalQuestions: 4, previousQuestions: { mode: "exclude", percent: 0, paperRange: 0 } },
      "PRACTICE_TEST",
    );

    const allIds = [...exam.result.questions, ...practice.result.questions].map((q) => q.id);
    const stats = await questionUsageRepository.statsForQuestions(f.org, allIds);
    // Every question from both papers is tracked regardless of paper type.
    for (const q of exam.result.questions) expect(stats.has(q.id)).toBe(true);
    for (const q of practice.result.questions) expect(stats.has(q.id)).toBe(true);

    // A third generation that excludes previous questions avoids both sets.
    const third = await generateSaved(
      f,
      { totalQuestions: 4, previousQuestions: { mode: "exclude", percent: 0, paperRange: 0 } },
      "ASSIGNMENT",
    );
    const prior = new Set(allIds);
    expect(third.result.questions.some((q) => prior.has(q.id))).toBe(false);
  });

  it("Q8/Q9: a new generation reads QuestionUsage, and only for the same organization", async () => {
    const { questionUsageRepository } = await import("@/lib/repositories/question-usage.repo");
    const a = await seedOrg("alpha", 20);
    const b = await seedOrg("beta", 20);

    const aPaper = await generateSaved(a, { totalQuestions: 6 });
    const aUsedIds = aPaper.result.questions.map((q) => q.id);

    // Org A: excluding previous questions must avoid A's used set.
    const aNext = await generateSaved(a, {
      totalQuestions: 6,
      previousQuestions: { mode: "exclude", percent: 0, paperRange: 0 },
    });
    expect(aNext.result.questions.some((q) => aUsedIds.includes(q.id))).toBe(false);

    // Org B: A's questions are not previous for B — B's own stats are empty,
    // and recentPaperIds for B sees nothing from A.
    expect((await questionUsageRepository.statsForQuestions(b.org, a.questionIds)).size).toBe(0);
    expect(await questionUsageRepository.recentPaperIds(b.org, 5)).toHaveLength(0);
  });

  it("Q5: editing a paper re-syncs usage to the final question set (adds new, drops removed)", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const { QuestionUsage } = await import("@/models");
    const f = await seedOrg("alpha", 20);

    const p = await generateSaved(f, { totalQuestions: 3 });
    const original = p.result.questions.map((q) => q.id);
    expect(new Set((await QuestionUsage.find({ questionPaperId: p.paper._id }).lean().exec()).map((u) => u.questionId.toString()))).toEqual(
      new Set(original),
    );

    // Keep the first two, drop the third, add a brand-new one.
    const kept = original.slice(0, 2);
    const added = f.questionIds.find((id) => !original.includes(id))!;
    const finalSet = [...kept, added];

    await paperService.update(
      p.paper._id.toString(),
      {
        organizationId: null,
        sections: [
          {
            title: "",
            instructions: "",
            order: 0,
            questions: finalSet.map((question, order) => ({ question, order, note: "" })),
          },
        ],
      },
      f.actor,
      audit,
    );

    const after = await QuestionUsage.find({ questionPaperId: p.paper._id }).select("questionId").lean().exec();
    expect(new Set(after.map((u) => u.questionId.toString()))).toEqual(new Set(finalSet));
    // The dropped question no longer counts as used in this paper.
    expect(after.some((u) => u.questionId.toString() === original[2])).toBe(false);
    // One paper, one edit — still one recent paper.
    const { questionUsageRepository } = await import("@/lib/repositories/question-usage.repo");
    expect(await questionUsageRepository.recentPaperIds(f.org, 10)).toHaveLength(1);
  });

  it("Q1: a manually built paper also records usage for its questions", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const { QuestionUsage } = await import("@/models");
    const f = await seedOrg("alpha", 10);
    const picked = f.questionIds.slice(0, 4);

    const manual = await paperService.create(
      {
        organizationId: null,
        title: "Hand-built model test",
        description: "",
        instructions: "",
        category: f.category.toString(),
        subject: f.subject.toString(),
        board: null,
        exam: null,
        year: null,
        durationMinutes: null,
        sections: [
          {
            title: "",
            instructions: "",
            order: 0,
            questions: picked.map((question, order) => ({ question, order, note: "" })),
          },
        ],
      },
      f.actor,
      audit,
    );

    const used = await QuestionUsage.find({ questionPaperId: manual._id }).select("questionId").lean().exec();
    expect(new Set(used.map((u) => u.questionId.toString()))).toEqual(new Set(picked));
  });

  it("Q10/Q11: deleting a paper clears its usage and drops it from recent papers", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const { QuestionUsage } = await import("@/models");
    const { questionUsageRepository } = await import("@/lib/repositories/question-usage.repo");
    const f = await seedOrg("alpha", 20);

    const keep = await generateSaved(f, { totalQuestions: 4 });
    const drop = await generateSaved(f, { totalQuestions: 4 });
    expect(await questionUsageRepository.recentPaperIds(f.org, 10)).toHaveLength(2);

    await paperService.remove(drop.paper._id.toString(), f.actor, audit);

    expect(await QuestionUsage.countDocuments({ questionPaperId: drop.paper._id })).toBe(0);
    expect(await QuestionUsage.countDocuments({ questionPaperId: keep.paper._id })).toBe(4);
    const recent = await questionUsageRepository.recentPaperIds(f.org, 10);
    expect(recent.map((id) => id.toString())).toEqual([keep.paper._id.toString()]);
  });

  it("Q7/Q10: editing five times leaves one recent paper, not five", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const { questionUsageRepository } = await import("@/lib/repositories/question-usage.repo");
    const f = await seedOrg("alpha", 30);
    const p = await generateSaved(f, { totalQuestions: 4 });

    for (let round = 0; round < 5; round += 1) {
      const pick = f.questionIds.slice(round, round + 4);
      await paperService.update(
        p.paper._id.toString(),
        {
          organizationId: null,
          sections: [
            {
              title: "",
              instructions: "",
              order: 0,
              questions: pick.map((question, order) => ({ question, order, note: "" })),
            },
          ],
        },
        f.actor,
        audit,
      );
    }

    expect(await questionUsageRepository.recentPaperIds(f.org, 10)).toHaveLength(1);
  });
});
