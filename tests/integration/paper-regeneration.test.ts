import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { AuditContext } from "@/lib/services/audit.service";
import type { GeneratePaperInput } from "@/lib/validation/paper.schema";

/**
 * Regeneration from the Paper View General sidebar. There is no versioning:
 * regenerating UPDATES THE SAME paper in place — new questions, new persisted
 * config, its usage rows re-synced. No new document, no title change, no
 * lineage. Organization / category / subject stay locked to the paper.
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
    email: `t-${id.toString()}@example.com`,
    name: "teacher",
    role: "teacher",
    status: "active",
    organizationId,
  };
}
const audit: AuditContext = { actor: null, requestId: "test", ip: "127.0.0.1" };

interface Fx {
  org: Types.ObjectId;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  teacher: Types.ObjectId;
  actor: AuthContext;
  qids: string[];
}

async function seedOrg(slug: string, count: number): Promise<Fx> {
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
    name: `${slug} t`,
    email: `${slug}-t@example.com`,
    password: "x",
    role: "teacher",
    organization: org._id,
  });
  await OrganizationMember.create({ userId: teacher._id, organizationId: org._id, role: "teacher", status: "active" });

  const difficulties = ["EASY", "MEDIUM", "HARD"] as const;
  const qids: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const text = `${slug} q${i}`;
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
        { id: "A", text: "a" },
        { id: "B", text: "b" },
      ],
      answer: { text: "", correctOptions: ["A"], booleanAnswer: null, matchingPairs: [] },
      contentHash: questionContentHash(chapter._id.toString(), text),
      marks: 1,
      status: "APPROVED",
      isActive: true,
      createdBy: teacher._id,
    });
    qids.push(q._id.toString());
  }
  return { org: org._id, category: category._id, subject: subject._id, chapter: chapter._id, teacher: teacher._id, actor: actorFor(teacher._id, org._id.toString()), qids };
}

function spec(f: Fx, o: Partial<GeneratePaperInput> = {}): GeneratePaperInput {
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
    totalQuestions: 8,
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
    ...o,
  };
}

async function generate(f: Fx, o: Partial<GeneratePaperInput> = {}, title = "Paper A") {
  const { paperService } = await import("@/lib/services/paper.service");
  return paperService.generateAndSave(
    { title, description: "d", instructions: "i", durationMinutes: 60, paperType: "MODEL_TEST", spec: spec(f, o) },
    f.actor,
    audit,
  );
}

async function regenerate(f: Fx, sourceId: string, o: Partial<GeneratePaperInput> = {}) {
  const { paperService } = await import("@/lib/services/paper.service");
  return paperService.regenerate(
    sourceId,
    { title: "ignored", description: "d", instructions: "i", durationMinutes: 60, paperType: "MODEL_TEST", spec: spec(f, o) },
    f.actor,
    audit,
  );
}

describe.skipIf(!available)("paper regeneration — in place", () => {
  it("persists the complete generation configuration on the paper", async () => {
    const { QuestionPaper } = await import("@/models");
    const f = await seedOrg("alpha", 20);
    const extra = f.qids[0]!;
    const { paper } = await generate(f, {
      totalQuestions: 6,
      difficultyDistribution: [{ difficulty: "EASY", count: 4 }],
      typeDistribution: [{ type: "MCQ", count: 6 }],
      previousQuestions: { mode: "prefer", percent: 30, paperRange: 5 },
      excludeRecentPapers: 2,
      mandatoryQuestionIds: [extra],
      excludedQuestionIds: [f.qids[19]!],
      randomize: { selection: true, order: true, options: true },
    });

    const gs = (await QuestionPaper.findById(paper._id).lean().exec())!.generationSpec!;
    expect(gs.category?.toString()).toBe(f.category.toString());
    expect(gs.subject?.toString()).toBe(f.subject.toString());
    expect(gs.totalQuestions).toBe(6);
    expect(gs.difficultyDistribution).toEqual([{ difficulty: "EASY", count: 4 }]);
    expect(gs.typeDistribution).toEqual([{ type: "MCQ", count: 6 }]);
    expect(gs.previousQuestions).toMatchObject({ mode: "prefer", percent: 30, paperRange: 5 });
    expect(gs.excludeRecentPapers).toBe(2);
    expect(gs.mandatoryQuestionIds.map((x) => x.toString())).toEqual([extra]);
    expect(gs.excludedQuestionIds.map((x) => x.toString())).toEqual([f.qids[19]!]);
    expect(gs.randomize).toMatchObject({ selection: true, order: true, options: true });
  });

  it("regenerate updates the SAME paper in place — no new document, no title change", async () => {
    const { QuestionPaper } = await import("@/models");
    const f = await seedOrg("alpha", 20);

    const a = await generate(f, { totalQuestions: 8 }, "My Model Test");
    const aBefore = (await QuestionPaper.findById(a.paper._id).lean().exec())!;

    const b = await regenerate(f, a.paper._id.toString(), { totalQuestions: 5 });

    // Same document.
    expect(b.paper._id.toString()).toBe(a.paper._id.toString());
    expect(b.paper.title).toBe("My Model Test");
    expect(b.paper.totalQuestions).toBe(5);
    expect(b.paper.generationSpec!.totalQuestions).toBe(5);
    // Questions actually changed.
    expect(JSON.stringify(b.paper.sections)).not.toBe(JSON.stringify(aBefore.sections));
    // Still exactly one paper in the organization.
    expect(await QuestionPaper.countDocuments({ organizationId: f.org, isActive: true })).toBe(1);
  });

  it("performs a fresh DB selection — regenerating with exclude avoids the paper's current questions", async () => {
    const f = await seedOrg("alpha", 20);
    const a = await generate(f, { totalQuestions: 8 });
    const aIds = new Set(a.result.questions.map((q) => q.id));

    const b = await regenerate(f, a.paper._id.toString(), {
      totalQuestions: 8,
      previousQuestions: { mode: "exclude", percent: 0, paperRange: 0 },
    });

    expect(b.result.questions).toHaveLength(8);
    expect(b.result.questions.some((q) => aIds.has(q.id))).toBe(false);
    expect(b.result.previousUsedCount).toBe(0);
  });

  it("re-syncs the paper's QuestionUsage to its new question set", async () => {
    const { QuestionUsage } = await import("@/models");
    const { questionUsageRepository } = await import("@/lib/repositories/question-usage.repo");
    const f = await seedOrg("alpha", 20);
    const a = await generate(f, { totalQuestions: 8 });
    expect(await QuestionUsage.countDocuments({ questionPaperId: a.paper._id })).toBe(8);

    const b = await regenerate(f, a.paper._id.toString(), { totalQuestions: 6 });

    // Same paper id; usage now matches the new selection exactly.
    const rows = await QuestionUsage.find({ questionPaperId: a.paper._id }).select("questionId").lean().exec();
    const bSel = new Set(b.result.questions.map((q) => q.id));
    expect(rows).toHaveLength(6);
    expect(rows.every((u) => bSel.has(u.questionId.toString()))).toBe(true);

    // One paper, one "recent paper".
    const recent = await questionUsageRepository.recentPaperIds(f.org, 10);
    expect(recent.map((id) => id.toString())).toEqual([a.paper._id.toString()]);
    expect(await QuestionUsage.countDocuments({ organizationId: { $ne: f.org } })).toBe(0);
  });

  it("regenerating repeatedly keeps exactly one paper and one paper's worth of usage", async () => {
    const { questionUsageRepository } = await import("@/lib/repositories/question-usage.repo");
    const { QuestionPaper } = await import("@/models");
    const f = await seedOrg("alpha", 30);
    const r1 = await generate(f, { totalQuestions: 6 });
    await regenerate(f, r1.paper._id.toString(), { totalQuestions: 6 });
    const r3 = await regenerate(f, r1.paper._id.toString(), { totalQuestions: 6 });

    expect(r3.paper._id.toString()).toBe(r1.paper._id.toString());
    expect(await QuestionPaper.countDocuments({ organizationId: f.org, isActive: true })).toBe(1);

    const r3Ids = r3.result.questions.map((q) => q.id);
    const stats = await questionUsageRepository.statsForQuestions(f.org, r3Ids);
    for (const id of r3Ids) expect(stats.get(id)?.count ?? 0).toBeLessThanOrEqual(1);
    const recent = await questionUsageRepository.recentPaperIds(f.org, 10);
    expect(recent.map((id) => id.toString())).toEqual([r1.paper._id.toString()]);
  });

  it("regeneration is locked to the paper's organization / category / subject", async () => {
    const { Question } = await import("@/models");
    const a = await seedOrg("abdullah", 20);
    const b = await seedOrg("udbash", 20);

    const paperA = await generate(a, { totalQuestions: 8 });
    const paperB = await generate(b, { totalQuestions: 8 });

    // Abdullah actor cannot reach a Udbash paper.
    await expect(regenerate(a, paperB.paper._id.toString())).rejects.toThrow();

    // Client tries to steer regeneration into Udbash — ignored.
    const regen = await regenerate(a, paperA.paper._id.toString(), {
      totalQuestions: 8,
      organizationId: b.org.toString() as unknown as null,
      category: b.category.toString(),
      subject: b.subject.toString(),
    });
    expect(regen.paper._id.toString()).toBe(paperA.paper._id.toString());
    const docs = await Question.find({ _id: { $in: regen.result.questions.map((q) => new Types.ObjectId(q.id)) } })
      .select("organizationId")
      .lean()
      .exec();
    expect(docs).toHaveLength(8);
    expect(docs.every((d) => d.organizationId.toString() === a.org.toString())).toBe(true);
    expect(regen.paper.generationSpec!.category?.toString()).toBe(a.category.toString());
  });

  it("still honours difficulty distribution during regeneration, borrowing when short", async () => {
    const f = await seedOrg("alpha", 15); // 5 EASY / 5 MEDIUM / 5 HARD
    const a = await generate(f, { totalQuestions: 8 });

    const b = await regenerate(f, a.paper._id.toString(), {
      totalQuestions: 10,
      previousQuestions: { mode: "allow", percent: 100, paperRange: 0 },
      difficultyDistribution: [
        { difficulty: "EASY", count: 8 }, // only 5 exist
        { difficulty: "HARD", count: 2 },
      ],
    });

    expect(b.result.selected).toBe(10);
    expect(b.result.difficultyActual.EASY).toBeLessThanOrEqual(5);
    expect(b.result.warnings.some((w) => w.code === "DIFFICULTY_SHORTFALL")).toBe(true);
  });

  it("spec scenario: paper regenerated with a new previous-question config, in place", async () => {
    const { QuestionPaper } = await import("@/models");
    const f = await seedOrg("alpha", 20);

    const a = await generate(f, {
      totalQuestions: 10,
      previousQuestions: { mode: "allow", percent: 20, paperRange: 5 },
    });
    const aSel = new Set(a.result.questions.map((q) => q.id));

    const b = await regenerate(f, a.paper._id.toString(), {
      totalQuestions: 10,
      previousQuestions: { mode: "exclude", percent: 0, paperRange: 0 },
    });

    expect(b.paper._id.toString()).toBe(a.paper._id.toString());
    const stored = (await QuestionPaper.findById(a.paper._id).lean().exec())!;
    expect(stored.generationSpec!.previousQuestions).toMatchObject({ mode: "exclude" });
    expect(b.result.questions.some((q) => aSel.has(q.id))).toBe(false);
    expect(await QuestionPaper.countDocuments({ organizationId: f.org, isActive: true })).toBe(1);
  });
});

describe.skipIf(!available)("paper design configuration", () => {
  it("a generated paper is saved with a default design config", async () => {
    const { QuestionPaper } = await import("@/models");
    const f = await seedOrg("alpha", 20);
    const { paper } = await generate(f, { totalQuestions: 6 });

    const dc = (await QuestionPaper.findById(paper._id).lean().exec())!.designConfig as Record<string, unknown>;
    expect(dc).toBeTruthy();
    expect(dc.header).toBeTruthy();
    expect(dc.paper).toMatchObject({ size: "A4", orientation: "portrait" });
    expect(dc.numbering).toMatchObject({ showQuestionNumber: true });
    expect(dc.randomize).toBeUndefined();
  });

  it("updateDesign persists appearance only — no regeneration, no usage change", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const { QuestionPaper, QuestionUsage } = await import("@/models");
    const f = await seedOrg("alpha", 20);
    const { paper } = await generate(f, { totalQuestions: 8 });
    const before = (await QuestionPaper.findById(paper._id).lean().exec())!;
    const usageBefore = await QuestionUsage.countDocuments({ questionPaperId: paper._id });

    const saved = await paperService.updateDesign(
      paper._id.toString(),
      {
        header: { organizationName: "Abdullah Org", totalMarks: "50" },
        paper: { size: "Legal", marginMm: 15 },
        numbering: { questionNumbering: "en-digit" },
      } as never,
      f.actor,
      audit,
    );

    expect((saved.designConfig as Record<string, Record<string, unknown>>).header!.organizationName).toBe("Abdullah Org");
    expect((saved.designConfig as Record<string, Record<string, unknown>>).paper!.size).toBe("Legal");

    const after = (await QuestionPaper.findById(paper._id).lean().exec())!;
    expect(JSON.stringify(after.sections)).toBe(JSON.stringify(before.sections));
    expect(JSON.stringify(after.generationSpec)).toBe(JSON.stringify(before.generationSpec));
    expect(await QuestionUsage.countDocuments({ questionPaperId: paper._id })).toBe(usageBefore);
    expect(await QuestionPaper.countDocuments({ organizationId: f.org, isActive: true })).toBe(1);
  });

  it("updateDesign is organization-scoped and ownership-checked", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const a = await seedOrg("abdullah", 20);
    const b = await seedOrg("udbash", 20);
    const { paper } = await generate(a, { totalQuestions: 6 });

    await expect(
      paperService.updateDesign(paper._id.toString(), { paper: { size: "A5" } } as never, b.actor, audit),
    ).rejects.toThrow();
  });

  it("regenerating keeps the paper's saved design untouched", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const f = await seedOrg("alpha", 20);
    const a = await generate(f, { totalQuestions: 8 });

    await paperService.updateDesign(
      a.paper._id.toString(),
      { header: { programName: "Annual Examination" }, paper: { size: "Letter" } } as never,
      f.actor,
      audit,
    );

    const b = await regenerate(f, a.paper._id.toString(), { totalQuestions: 6 });
    const bd = b.paper.designConfig as Record<string, Record<string, unknown>>;
    expect(bd.header!.programName).toBe("Annual Examination");
    expect(bd.paper!.size).toBe("Letter");
  });
});
