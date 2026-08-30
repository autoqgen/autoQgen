import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

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

  it("generates a paper without duplicates and only from approved questions", async () => {
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const seeded = await seed(12);

    const result = await paperGeneratorService.generate({
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
      status: "APPROVED",
    }, seeded.org._id.toString());

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

  it("honours a difficulty distribution", async () => {
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const seeded = await seed(12);

    const result = await paperGeneratorService.generate({
      organizationId: null,
      category: seeded.category._id.toString(),
      subject: seeded.subject._id.toString(),
      chapters: [seeded.chapter._id.toString()],
      topics: [],
      board: null,
      exam: null,
      year: null,
      language: null,
      totalQuestions: 4,
      totalMarks: null,
      difficultyDistribution: [
        { difficulty: "EASY", count: 2 },
        { difficulty: "HARD", count: 2 },
      ],
      typeDistribution: [],
      status: "APPROVED",
    }, seeded.org._id.toString());

    const easy = result.questions.filter((q) => q.difficulty === "EASY");
    const hard = result.questions.filter((q) => q.difficulty === "HARD");

    expect(easy).toHaveLength(2);
    expect(hard).toHaveLength(2);
  });

  it("warns rather than silently returning a short paper", async () => {
    const { paperGeneratorService } = await import("@/lib/services/paper-generator.service");
    const seeded = await seed(3);

    const result = await paperGeneratorService.generate({
      organizationId: null,
      category: seeded.category._id.toString(),
      subject: seeded.subject._id.toString(),
      chapters: [seeded.chapter._id.toString()],
      topics: [],
      board: null,
      exam: null,
      year: null,
      language: null,
      totalQuestions: 20,
      totalMarks: null,
      difficultyDistribution: [],
      typeDistribution: [],
      status: "APPROVED",
    }, seeded.org._id.toString());

    expect(result.selected).toBeLessThan(20);
    expect(result.warnings.some((w) => w.code === "TOTAL_SHORTFALL")).toBe(true);
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

  it("computes totals server-side and versions every change", async () => {
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
    expect(paper.version).toBe(1);

    const updated = await paperService.update(
      paper._id.toString(),
      { title: "Renamed paper" },
      actor,
      audit,
    );

    expect(updated.version).toBe(2);
    expect(updated.versionHistory.length).toBeGreaterThan(1);
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
    expect(clone.version).toBe(1);
    expect(clone.clonedFrom?.toString()).toBe(original._id.toString());
    expect(clone.totalQuestions).toBe(original.totalQuestions);
  });
});
