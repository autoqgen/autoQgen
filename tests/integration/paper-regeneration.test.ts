import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { AuditContext } from "@/lib/services/audit.service";
import type { GeneratePaperInput } from "@/lib/validation/paper.schema";

/**
 * Regeneration from the Paper View page: the generation config is persisted in
 * full, a regeneration is a fresh DB selection that creates a NEW paper in the
 * same lineage, the source paper is never modified, usage is recorded per
 * paper, and organization isolation is enforced from the source paper.
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

async function regenerate(f: Fx, sourceId: string, o: Partial<GeneratePaperInput> = {}, title = "Paper B") {
  const { paperService } = await import("@/lib/services/paper.service");
  return paperService.regenerate(
    sourceId,
    { title, description: "d", instructions: "i", durationMinutes: 60, paperType: "MODEL_TEST", spec: spec(f, o) },
    f.actor,
    audit,
  );
}

describe.skipIf(!available)("paper regeneration", () => {
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
    expect(paper.generationRound).toBe(1);
    expect(paper.rootPaperId?.toString()).toBe(paper._id.toString());
  });

  it("regenerate creates a NEW paper in the same lineage and leaves the source untouched", async () => {
    const { QuestionPaper } = await import("@/models");
    const f = await seedOrg("alpha", 20);

    const a = await generate(f, { totalQuestions: 8 });
    const aBefore = (await QuestionPaper.findById(a.paper._id).lean().exec())!;

    const b = await regenerate(f, a.paper._id.toString(), { totalQuestions: 5 });

    expect(b.paper._id.toString()).not.toBe(a.paper._id.toString());
    expect(b.paper.generationRound).toBe(2);
    expect(b.paper.regeneratedFrom?.toString()).toBe(a.paper._id.toString());
    expect(b.paper.rootPaperId?.toString()).toBe(a.paper._id.toString());
    expect(b.paper.totalQuestions).toBe(5);
    expect(b.paper.generationSpec!.totalQuestions).toBe(5);

    // Source paper: completely unchanged.
    const aAfter = (await QuestionPaper.findById(a.paper._id).lean().exec())!;
    expect(aAfter.generationRound).toBe(1);
    expect(aAfter.totalQuestions).toBe(8);
    expect(JSON.stringify(aAfter.sections)).toBe(JSON.stringify(aBefore.sections));
  });

  it("performs a fresh DB selection — not a reshuffle of the source paper", async () => {
    const f = await seedOrg("alpha", 20);
    const a = await generate(f, { totalQuestions: 8 });
    const aIds = new Set(a.result.questions.map((q) => q.id));

    // Regenerate excluding all previously-used questions → B must be disjoint from A.
    const b = await regenerate(f, a.paper._id.toString(), {
      totalQuestions: 8,
      previousQuestions: { mode: "exclude", percent: 0, paperRange: 0 },
    });

    expect(b.result.questions).toHaveLength(8);
    expect(b.result.questions.some((q) => aIds.has(q.id))).toBe(false);
    expect(b.result.previousUsedCount).toBe(0);
  });

  it("records new QuestionUsage for the new paper without touching the source paper's usage", async () => {
    const { QuestionUsage } = await import("@/models");
    const f = await seedOrg("alpha", 20);
    const a = await generate(f, { totalQuestions: 8 });
    const b = await regenerate(f, a.paper._id.toString(), { totalQuestions: 6 });

    expect(await QuestionUsage.countDocuments({ questionPaperId: a.paper._id })).toBe(8);
    expect(await QuestionUsage.countDocuments({ questionPaperId: b.paper._id })).toBe(6);
    // usage only for selected questions
    const bUsed = await QuestionUsage.find({ questionPaperId: b.paper._id }).select("questionId").lean().exec();
    const bSel = new Set(b.result.questions.map((q) => q.id));
    expect(bUsed.every((u) => bSel.has(u.questionId.toString()))).toBe(true);
    // all usage rows are Abdullah-scoped (org from the source paper)
    expect(await QuestionUsage.countDocuments({ organizationId: { $ne: f.org } })).toBe(0);
  });

  it("regeneration is locked to the source paper's organization / category / subject", async () => {
    const { Question } = await import("@/models");
    const a = await seedOrg("abdullah", 20);
    const b = await seedOrg("udbash", 20);

    const paperA = await generate(a, { totalQuestions: 8 });

    // Abdullah actor cannot even reach a Udbash paper to regenerate it.
    const paperB = await generate(b, { totalQuestions: 8 });
    await expect(regenerate(a, paperB.paper._id.toString())).rejects.toThrow();

    // Client tries to steer regeneration into Udbash — ignored; result stays Abdullah.
    const regen = await regenerate(a, paperA.paper._id.toString(), {
      totalQuestions: 8,
      organizationId: b.org.toString() as unknown as null,
      category: b.category.toString(),
      subject: b.subject.toString(),
    });
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

  it("generationHistory lists every round of the lineage, newest first", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const f = await seedOrg("alpha", 20);
    const a = await generate(f, { totalQuestions: 8 });
    const b = await regenerate(f, a.paper._id.toString(), { totalQuestions: 6 });
    const c = await paperService.regenerate(
      b.paper._id.toString(),
      { title: "C", description: "", instructions: "", durationMinutes: null, paperType: "OTHER", spec: spec(f, { totalQuestions: 4 }) },
      f.actor,
      audit,
    );

    const history = await paperService.generationHistory(c.paper._id.toString(), f.actor);
    expect(history.map((h) => h.generationRound)).toEqual([3, 2, 1]);
    expect(history.map((h) => h._id.toString())).toEqual([
      c.paper._id.toString(),
      b.paper._id.toString(),
      a.paper._id.toString(),
    ]);
    // history from the root paper resolves the same lineage
    const fromRoot = await paperService.generationHistory(a.paper._id.toString(), f.actor);
    expect(fromRoot).toHaveLength(3);
  });

  it("spec scenario: Paper A (previous 20%) → edit to 0% → Paper B, A unchanged, B has its own config", async () => {
    const { QuestionPaper } = await import("@/models");
    const f = await seedOrg("alpha", 20);

    const a = await generate(f, {
      totalQuestions: 10,
      previousQuestions: { mode: "allow", percent: 20, paperRange: 5 },
    });
    const aBody = JSON.stringify((await QuestionPaper.findById(a.paper._id).lean().exec())!);

    const b = await regenerate(f, a.paper._id.toString(), {
      totalQuestions: 10,
      previousQuestions: { mode: "exclude", percent: 0, paperRange: 0 },
    });

    // A untouched
    expect(JSON.stringify((await QuestionPaper.findById(a.paper._id).lean().exec())!)).toBe(aBody);
    // B is a new paper with a fresh selection and its own saved config
    expect(b.paper._id.toString()).not.toBe(a.paper._id.toString());
    expect(b.paper.generationSpec!.previousQuestions).toMatchObject({ mode: "exclude" });
    const aSel = new Set(a.result.questions.map((q) => q.id));
    expect(b.result.questions.some((q) => aSel.has(q.id))).toBe(false);
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
    expect(dc.randomize).toBeUndefined(); // design and generation are separate blobs
  });

  it("updateDesign persists appearance only — no regeneration, no version bump, no usage change", async () => {
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
    expect((saved.designConfig as Record<string, Record<string, unknown>>).numbering!.questionNumbering).toBe("en-digit");

    const after = (await QuestionPaper.findById(paper._id).lean().exec())!;
    expect(after.version).toBe(before.version); // no version bump
    expect(after.generationRound).toBe(before.generationRound);
    expect(JSON.stringify(after.sections)).toBe(JSON.stringify(before.sections)); // questions unchanged
    expect(JSON.stringify(after.generationSpec)).toBe(JSON.stringify(before.generationSpec));
    expect(await QuestionUsage.countDocuments({ questionPaperId: paper._id })).toBe(usageBefore); // usage unchanged
    expect(await QuestionPaper.countDocuments({ rootPaperId: paper._id })).toBe(1); // no new paper
  });

  it("updateDesign is organization-scoped and ownership-checked", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const a = await seedOrg("abdullah", 20);
    const b = await seedOrg("udbash", 20);
    const { paper } = await generate(a, { totalQuestions: 6 });

    // A Udbash actor cannot even see the Abdullah paper.
    await expect(
      paperService.updateDesign(paper._id.toString(), { paper: { size: "A5" } } as never, b.actor, audit),
    ).rejects.toThrow();
  });

  it("a regenerated paper inherits the source paper's saved design", async () => {
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
