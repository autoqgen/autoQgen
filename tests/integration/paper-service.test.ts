import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";
import type { GeneratePaperInput } from "@/lib/validation/paper.schema";

/**
 * Resolved via top-level await, not inside beforeAll: describe.skipIf below
 * reads `available` synchronously while the describe body is registered,
 * which happens *before* beforeAll ever runs — a beforeAll-set flag would
 * always still be `false` at that point and the suite would silently always
 * skip regardless of whether a database was actually available.
 */
const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

function actorFor(id: Types.ObjectId, role: UserRole, organizationId: string | null = null): AuthContext {
  return {
    id: id.toString(),
    objectId: id,
    email: `${role}@example.com`,
    name: role,
    role,
    status: "active",
    organizationId,
  };
}

const audit = { actor: null, requestId: "test", ip: "127.0.0.1" };

describe.skipIf(!available)("paper service", () => {
  /**
   * Papers, questions and taxonomy are tenant-scoped: they all carry an
   * `organizationId`, and the services resolve the acting tenant from the
   * caller's active OrganizationMember. The fixture builds one organization,
   * enrols the test user in it, and returns its id for the generator calls.
   */
  async function seed(approvedCount = 12) {
    const { Organization, OrganizationMember, Category, Subject, Chapter, User, Question } = await import("@/models");
    const { questionContentHash } = await import("@/lib/security/hash");

    const org = await Organization.create({ name: "Seed Org", slug: "seed-org" });
    const category = await Category.create({ organizationId: org._id, name: "Class 9-10", slug: "class-9-10" });
    const subject = await Subject.create({
      organizationId: org._id,
      name: "Physics",
      slug: "physics",
      category: category._id,
    });
    const chapter = await Chapter.create({
      organizationId: org._id,
      name: "Force",
      slug: "force",
      category: category._id,
      subject: subject._id,
    });

    const teacher = await User.create({
      name: "Tara",
      email: "tara@example.com",
      password: "x",
      role: "teacher",
      organization: org._id,
    });
    await OrganizationMember.create({ userId: teacher._id, organizationId: org._id, role: "teacher", status: "active" });

    const difficulties = ["EASY", "MEDIUM", "HARD"] as const;
    const types = ["MCQ", "TRUE_FALSE"] as const;
    const questions = [];

    for (let index = 0; index < approvedCount; index += 1) {
      const text = `Approved question number ${index}`;
      const type = types[index % types.length];

      questions.push(
        await Question.create({
          organizationId: org._id,
          category: category._id,
          subject: subject._id,
          chapter: chapter._id,
          type,
          difficulty: difficulties[index % difficulties.length],
          question: { text },
          options:
            type === "MCQ"
              ? [
                  { id: "A", text: "one" },
                  { id: "B", text: "two" },
                ]
              : [],
          answer: {
            text: "",
            correctOptions: type === "MCQ" ? ["A"] : [],
            booleanAnswer: type === "TRUE_FALSE" ? true : null,
            matchingPairs: [],
          },
          contentHash: questionContentHash(chapter._id.toString(), text),
          marks: 1,
          status: "APPROVED",
          isActive: true,
          createdBy: teacher._id,
        }),
      );
    }

    // One draft question, which must never be selectable.
    const draftText = "Unapproved draft question";
    await Question.create({
      organizationId: org._id,
      category: category._id,
      subject: subject._id,
      chapter: chapter._id,
      type: "MCQ",
      difficulty: "EASY",
      question: { text: draftText },
      options: [
        { id: "A", text: "one" },
        { id: "B", text: "two" },
      ],
      answer: { text: "", correctOptions: ["A"], booleanAnswer: null, matchingPairs: [] },
      contentHash: questionContentHash(chapter._id.toString(), draftText),
      marks: 1,
      status: "DRAFT",
      isActive: true,
      createdBy: teacher._id,
    });

    return { org, category, subject, chapter, teacher, questions };
  }

  function genSpec(
    seeded: Awaited<ReturnType<typeof seed>>,
    overrides: Partial<GeneratePaperInput> = {},
  ): GeneratePaperInput {
    return {
      organizationId: null,
      category: seeded.category._id.toString(),
      subject: seeded.subject._id.toString(),
      chapters: [seeded.chapter._id.toString()],
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
      previousQuestions: { mode: "allow" as const, percent: 100, paperRange: 0 },
      excludeRecentPapers: 0,
      mandatoryQuestionIds: [],
      excludedQuestionIds: [],
      creativeOnly: false,
      randomize: { selection: true, order: true, options: true },
      status: "APPROVED" as const,
      ...overrides,
    };
  }

  it("generates a paper without duplicates and only from approved questions", async () => {
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const seeded = await seed(12);

    const result = await paperGeneratorService.generate(
      genSpec(seeded, { totalQuestions: 8 }),
      seeded.org._id.toString(),
    );

    expect(result.selected).toBe(8);
    expect(new Set(result.questions.map((q) => q.id)).size).toBe(8);

    const { Question } = await import("@/models");
    const statuses = await Question.find({
      _id: { $in: result.questions.map((q) => new Types.ObjectId(q.id)) },
    })
      .select("status")
      .lean()
      .exec();

    expect(statuses.every((doc) => doc.status === "APPROVED")).toBe(true);
  });

  it("allocates Admission questions across only the selected subjects", async () => {
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const { Chapter, Question, Subject } = await import("@/models");
    const { questionContentHash } = await import("@/lib/security/hash");
    const seeded = await seed(4);
    const secondSubject = await Subject.create({
      organizationId: seeded.org._id,
      name: "Chemistry",
      slug: "chemistry",
      category: seeded.category._id,
    });
    const secondChapter = await Chapter.create({
      organizationId: seeded.org._id,
      name: "Mixtures",
      slug: "mixtures",
      category: seeded.category._id,
      subject: secondSubject._id,
    });

    for (let index = 0; index < 4; index += 1) {
      const text = `Admission Chemistry question ${index}`;
      await Question.create({
        organizationId: seeded.org._id,
        category: seeded.category._id,
        subject: secondSubject._id,
        chapter: secondChapter._id,
        type: "WRITTEN",
        difficulty: "MEDIUM",
        question: { text },
        options: [],
        answer: { text: "Answer", correctOptions: [], booleanAnswer: null, matchingPairs: [] },
        contentHash: questionContentHash(secondChapter._id.toString(), text),
        marks: 1,
        status: "APPROVED",
        isActive: true,
        createdBy: seeded.teacher._id,
      });
    }

    const admissionSpec = genSpec(seeded, {
      totalQuestions: 4,
      admissionSubjects: [
        { subject: seeded.subject._id.toString(), percentage: 50, chapters: [seeded.chapter._id.toString()] },
        { subject: secondSubject._id.toString(), percentage: 50, chapters: [secondChapter._id.toString()] },
      ],
    });
    const availability = await paperGeneratorService.availability(admissionSpec, seeded.org._id.toString());
    expect(availability.eligibleCount).toBe(8);

    const result = await paperGeneratorService.generate(
      admissionSpec,
      seeded.org._id.toString(),
    );

    expect(result.selected).toBe(4);
    const selected = await Question.find({
      _id: { $in: result.questions.map((question) => new Types.ObjectId(question.id)) },
    }).select("subject").lean().exec();
    expect(selected).toHaveLength(4);
    expect(selected.filter((question) => question.subject?.toString() === seeded.subject._id.toString())).toHaveLength(2);
    expect(selected.filter((question) => question.subject?.toString() === secondSubject._id.toString())).toHaveLength(2);
    expect(new Set(selected.map((question) => question.subject?.toString())).size).toBe(2);
  });

  it("keeps a selected Creative Question complete and rejects partial paper references", async () => {
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const { paperService } = await import("@/lib/services/paper.service");
    const { questionService } = await import("@/lib/services/question.service");
    const { Question } = await import("@/models");
    const { createCreativeGroupSchema } = await import("@/lib/validation/question.schema");
    const { createPaperSchema } = await import("@/lib/validation/paper.schema");
    const seeded = await seed(4);
    const actor = actorFor(seeded.teacher._id, "teacher", seeded.org._id.toString());
    const labels = ["ক", "খ", "গ", "ঘ"] as const;
    const levels = ["knowledge", "understanding", "application", "higher_order"] as const;
    const group = createCreativeGroupSchema.parse({
      category: seeded.category._id.toString(),
      subject: seeded.subject._id.toString(),
      chapter: seeded.chapter._id.toString(),
      creativeStimulus: "A ball slows down while rolling over a rough floor.",
      parts: labels.map((label, index) => ({
        type: "WRITTEN",
        language: "bn",
        question: { text: `CQ paper part ${index + 1}: explain the ball's motion.` },
        answer: { text: `Answer ${index + 1}`, correctOptions: [], booleanAnswer: null, matchingPairs: [] },
        creativePartLabel: label,
        cognitiveLevel: levels[index],
        marks: index + 1,
      })),
    });
    const created = await questionService.createCreativeGroup(group, actor);
    const additionalGroups = await Promise.all(
      ["CQ group 2", "CQ group 3"].map((name) =>
        questionService.createCreativeGroup(
          {
            ...group,
            creativeStimulus: `${name} stimulus.`,
            parts: group.parts.map((part, index) => ({
              ...part,
              question: { ...part.question, text: `${name} part ${index + 1}.` },
              answer: { ...part.answer, text: `${name} answer ${index + 1}.` },
            })),
          },
          actor,
        ),
      ),
    );
    const groupIds = [created.creativeGroupId, ...additionalGroups.map((item) => item.creativeGroupId)];
    await Question.updateMany(
      { creativeGroupId: { $in: groupIds } },
      { $set: { status: "APPROVED" } },
    ).exec();
    await Question.updateMany(
      { organizationId: seeded.org._id, creativeGroupId: { $exists: false } },
      { $set: { isActive: false } },
    ).exec();
    const ids = created.questions
      .map((question) => question._id?.toString())
      .filter((id): id is string => Boolean(id));
    expect(ids).toHaveLength(4);
    const availability = await paperGeneratorService.availability(
      genSpec(seeded, { totalQuestions: 1, creativeOnly: true }),
      seeded.org._id.toString(),
    );
    expect(availability.eligibleCount).toBe(3);
    const admissionResult = await paperGeneratorService.generate(
      genSpec(seeded, {
        totalQuestions: 1,
        creativeOnly: true,
        admissionSubjects: [{
          subject: seeded.subject._id.toString(),
          percentage: 100,
          chapters: [seeded.chapter._id.toString()],
        }],
      }),
      seeded.org._id.toString(),
    );
    expect(admissionResult.selected).toBe(1);
    expect(admissionResult.questions).toHaveLength(4);
    expect(new Set(admissionResult.questions.map((question) => question.creativeGroupId)).size).toBe(1);

    const cqOnlyGenerated = await paperGeneratorService.generate(
      genSpec(seeded, { totalQuestions: 1, creativeOnly: true }),
      seeded.org._id.toString(),
    );
    expect(cqOnlyGenerated.selected).toBe(1);
    expect(cqOnlyGenerated.questions).toHaveLength(4);
    const selectedCqIds = new Set(cqOnlyGenerated.questions.map((question) => question.creativeGroupId));
    expect(selectedCqIds.size).toBe(1);
    expect(groupIds).toContain([...selectedCqIds][0]);

    const generated = await paperGeneratorService.generate(
      genSpec(seeded, {
        totalQuestions: 1,
        mandatoryQuestionIds: [...ids].reverse(),
        randomize: { selection: false, order: true, options: false },
      }),
      seeded.org._id.toString(),
    );
    const generatedQuestions = await Question.find({
      _id: { $in: generated.questions.map((question) => new Types.ObjectId(question.id)) },
    }).select("_id creativePartLabel").lean().exec();
    const labelById = new Map(generatedQuestions.map((question) => [question._id.toString(), question.creativePartLabel]));
    expect(generated.questions.map((question) => labelById.get(question.id))).toEqual(labels);
    expect(generated.selected).toBe(1);
    expect(generated.questions).toHaveLength(4);

    const completePaper = await paperService.create(
      createPaperSchema.parse({
        title: "Complete CQ",
        category: seeded.category._id.toString(),
        subject: seeded.subject._id.toString(),
        sections: [{
          order: 0,
          questions: generated.questions.map((question, order) => ({
            question: question.id,
            order,
            marks: question.marks,
          })),
        }],
      }),
      actor,
      audit,
    );
    expect(completePaper.totalQuestions).toBe(1);
    expect(completePaper.totalMarks).toBe(10);

    const partialPaper = createPaperSchema.parse({
      title: "Partial CQ",
      category: seeded.category._id.toString(),
      subject: seeded.subject._id.toString(),
      sections: [{
        order: 0,
        questions: ids.slice(0, 3).map((question, order) => ({ question, order })),
      }],
    });
    await expect(paperService.create(partialPaper, actor, audit)).rejects.toMatchObject({
      details: expect.arrayContaining([
        expect.objectContaining({ message: "A Creative Question must include all four approved parts." }),
      ]),
    });
  });

  it("honours a difficulty distribution", async () => {
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const seeded = await seed(12);

    const result = await paperGeneratorService.generate(
      genSpec(seeded, {
        totalQuestions: 4,
        difficultyDistribution: [
          { difficulty: "EASY", count: 2 },
          { difficulty: "HARD", count: 2 },
        ],
      }),
      seeded.org._id.toString(),
    );

    const easy = result.questions.filter((q) => q.difficulty === "EASY");
    const hard = result.questions.filter((q) => q.difficulty === "HARD");

    expect(easy).toHaveLength(2);
    expect(hard).toHaveLength(2);
  });

  it("fails only when the organization has too few eligible questions for the total", async () => {
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const seeded = await seed(3);

    await expect(
      paperGeneratorService.generate(
        genSpec(seeded, { totalQuestions: 20 }),
        seeded.org._id.toString(),
      ),
    ).rejects.toThrow(/eligible question/i);
  });

  it("still hits the total by borrowing from the closest bucket when one is short", async () => {
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    // seed(12) => 4 EASY / 4 MEDIUM / 4 HARD approved.
    const seeded = await seed(12);

    const result = await paperGeneratorService.generate(
      genSpec(seeded, {
        totalQuestions: 10,
        difficultyDistribution: [
          { difficulty: "EASY", count: 8 }, // only 4 exist
          { difficulty: "HARD", count: 2 },
        ],
      }),
      seeded.org._id.toString(),
    );

    // Flexible: the total is still met, using the best available mix.
    expect(result.selected).toBe(10);
    expect(result.questions).toHaveLength(10);
    expect(result.difficultyActual.EASY).toBeLessThanOrEqual(4);
    expect(result.warnings.some((w) => w.code === "DIFFICULTY_SHORTFALL")).toBe(true);
  });

  it("refuses to add an unapproved question to a manual paper", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const { Question } = await import("@/models");
    const seeded = await seed(2);

    const draft = await Question.findOne({ status: "DRAFT" }).lean().exec();
    expect(draft).toBeTruthy();

    await expect(
      paperService.create(
        {
          organizationId: null,
          title: "Bad paper",
          description: "",
          instructions: "",
          category: seeded.category._id.toString(),
          subject: seeded.subject._id.toString(),
          board: null,
          exam: null,
          year: null,
          durationMinutes: null,
          sections: [
            {
              title: "",
              instructions: "",
              order: 0,
              questions: [{ question: draft!._id.toString(), order: 0, note: "" }],
            },
          ],
        },
        actorFor(seeded.teacher._id, "teacher", seeded.org._id.toString()),
        audit,
      ),
    ).rejects.toThrow();
  });

  it("rejects the same question twice in one paper", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const seeded = await seed(2);
    const questionId = seeded.questions[0]!._id.toString();

    await expect(
      paperService.create(
        {
          organizationId: null,
          title: "Duplicate paper",
          description: "",
          instructions: "",
          category: seeded.category._id.toString(),
          subject: seeded.subject._id.toString(),
          board: null,
          exam: null,
          year: null,
          durationMinutes: null,
          sections: [
            {
              title: "",
              instructions: "",
              order: 0,
              questions: [
                { question: questionId, order: 0, note: "" },
                { question: questionId, order: 1, note: "" },
              ],
            },
          ],
        },
        actorFor(seeded.teacher._id, "teacher", seeded.org._id.toString()),
        audit,
      ),
    ).rejects.toThrow();
  });

  it("computes totals server-side and applies edits in place", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const seeded = await seed(3);
    const actor = actorFor(seeded.teacher._id, "teacher", seeded.org._id.toString());

    const paper = await paperService.create(
      {
        organizationId: null,
        title: "Good paper",
        description: "",
        instructions: "",
        category: seeded.category._id.toString(),
        subject: seeded.subject._id.toString(),
        board: null,
        exam: null,
        year: null,
        durationMinutes: 60,
        sections: [
          {
            title: "Section A",
            instructions: "",
            order: 0,
            questions: seeded.questions.slice(0, 3).map((question, index) => ({
              question: question._id.toString(),
              order: index,
              note: "",
            })),
          },
        ],
      },
      actor,
      audit,
    );

    expect(paper.totalQuestions).toBe(3);
    expect(paper.totalMarks).toBe(3);

    const updated = await paperService.update(
      paper._id.toString(),
      { title: "Renamed paper" },
      actor,
      audit,
    );

    expect(updated._id.toString()).toBe(paper._id.toString());
    expect(updated.title).toBe("Renamed paper");
    expect(updated.totalQuestions).toBe(3);
  });

  it("blocks a teacher from publishing and allows a moderator", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const seeded = await seed(2);
    const teacher = actorFor(seeded.teacher._id, "teacher", seeded.org._id.toString());

    const paper = await paperService.create(
      {
        organizationId: null,
        title: "Publishable",
        description: "",
        instructions: "",
        category: seeded.category._id.toString(),
        subject: seeded.subject._id.toString(),
        board: null,
        exam: null,
        year: null,
        durationMinutes: null,
        sections: [
          {
            title: "",
            instructions: "",
            order: 0,
            questions: [{ question: seeded.questions[0]!._id.toString(), order: 0, note: "" }],
          },
        ],
      },
      teacher,
      audit,
    );

    await expect(
      paperService.changeStatus(paper._id.toString(), "PUBLISHED", teacher, audit),
    ).rejects.toThrow();

    const moderator = actorFor(seeded.teacher._id, "moderator", seeded.org._id.toString());
    const published = await paperService.changeStatus(
      paper._id.toString(),
      "PUBLISHED",
      moderator,
      audit,
    );

    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).toBeTruthy();
  });

  it("clones a paper as a fresh draft owned by the cloner", async () => {
    const { paperService } = await import("@/lib/services/paper.service");
    const seeded = await seed(2);
    const actor = actorFor(seeded.teacher._id, "teacher", seeded.org._id.toString());

    const original = await paperService.create(
      {
        organizationId: null,
        title: "Original",
        description: "",
        instructions: "",
        category: seeded.category._id.toString(),
        subject: seeded.subject._id.toString(),
        board: null,
        exam: null,
        year: null,
        durationMinutes: null,
        sections: [
          {
            title: "",
            instructions: "",
            order: 0,
            questions: [{ question: seeded.questions[0]!._id.toString(), order: 0, note: "" }],
          },
        ],
      },
      actor,
      audit,
    );

    const clone = await paperService.clone(original._id.toString(), actor, audit);

    expect(clone.title).toContain("copy");
    expect(clone.status).toBe("DRAFT");
    expect(clone.clonedFrom?.toString()).toBe(original._id.toString());
    expect(clone.totalQuestions).toBe(original.totalQuestions);
  });
});
