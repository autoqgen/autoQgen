import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

let available = false;
let stop: (() => Promise<void>) | null = null;

beforeAll(async () => {
  const harness = await startDatabase();
  available = harness !== null;
  stop = harness?.stop ?? null;
});

afterAll(async () => {
  await stop?.();
});

beforeEach(async () => {
  if (available) await clearCollections();
});

function actorFor(id: Types.ObjectId, role: UserRole): AuthContext {
  return {
    id: id.toString(),
    objectId: id,
    email: `${role}@example.com`,
    name: role,
    role,
    status: "active",
  };
}

describe.skipIf(!available)("question service", () => {
  async function seedTaxonomy() {
    const { Category, Subject, Chapter, User } = await import("@/models");

    const category = await Category.create({ name: "Class 9-10", slug: "class-9-10" });
    const subject = await Subject.create({
      name: "Physics",
      slug: "physics",
      category: category._id,
    });
    const chapter = await Chapter.create({
      name: "Force",
      slug: "force",
      category: category._id,
      subject: subject._id,
    });
    const otherSubject = await Subject.create({
      name: "Chemistry",
      slug: "chemistry",
      category: category._id,
    });

    const teacher = await User.create({
      name: "Tara",
      email: "tara@example.com",
      password: "x",
      role: "teacher",
    });
    const other = await User.create({
      name: "Other",
      email: "other@example.com",
      password: "x",
      role: "teacher",
    });

    return { category, subject, chapter, otherSubject, teacher, other };
  }

  function payload(ids: {
    category: Types.ObjectId | { _id: Types.ObjectId };
    subject: Types.ObjectId | { _id: Types.ObjectId };
    chapter: Types.ObjectId | { _id: Types.ObjectId };
  }) {
    const catId = "_id" in ids.category ? ids.category._id : ids.category;
    const subId = "_id" in ids.subject ? ids.subject._id : ids.subject;
    const chapId = "_id" in ids.chapter ? ids.chapter._id : ids.chapter;

    return {
      category: catId.toString(),
      subject: subId.toString(),
      chapter: chapId.toString(),
      topic: null,
      board: null,
      exam: null,
      type: "MCQ" as const,
      difficulty: "EASY" as const,
      language: "en" as const,
      question: { text: "What is the SI unit of force?", image: "", audio: "", video: "", passage: "", latex: "" },
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
      status: "DRAFT" as const,
    };
  }

  it("derives createdBy from the session, ignoring the request body", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question } = await import("@/models");
    const seeded = await seedTaxonomy();

    const forged = new Types.ObjectId();
    const input = { ...payload(seeded), createdBy: forged.toString() } as ReturnType<typeof payload>;

    const created = await questionService.create(input, actorFor(seeded.teacher._id, "teacher"));

    const stored = await Question.findById(created._id).lean().exec();
    expect(stored?.createdBy.toString()).toBe(seeded.teacher._id.toString());
    expect(stored?.createdBy.toString()).not.toBe(forged.toString());
  });

  it("rejects a chapter that does not belong to the supplied subject", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const seeded = await seedTaxonomy();

    const input = payload({
      category: seeded.category._id,
      subject: seeded.otherSubject._id,
      chapter: seeded.chapter._id,
    });

    await expect(
      questionService.create(input, actorFor(seeded.teacher._id, "teacher")),
    ).rejects.toThrow();
  });

  it("rejects a duplicate question in the same chapter", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const seeded = await seedTaxonomy();
    const actor = actorFor(seeded.teacher._id, "teacher");

    await questionService.create(payload(seeded), actor);
    await expect(questionService.create(payload(seeded), actor)).rejects.toThrow();
  });

  it("prevents a student from creating a question", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const seeded = await seedTaxonomy();

    await expect(
      questionService.create(payload(seeded), actorFor(seeded.teacher._id, "student")),
    ).rejects.toThrow();
  });

  it("prevents a teacher from editing another user's question", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const seeded = await seedTaxonomy();

    const created = await questionService.create(
      payload(seeded),
      actorFor(seeded.teacher._id, "teacher"),
    );

    await expect(
      questionService.update(
        created._id!.toString(),
        { marks: 5, reviewNote: "" },
        actorFor(seeded.other._id, "teacher"),
      ),
    ).rejects.toThrow();
  });

  it("prevents a teacher from self-approving a question", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const seeded = await seedTaxonomy();

    await expect(
      questionService.create(
        { ...payload(seeded), status: "APPROVED" },
        actorFor(seeded.teacher._id, "teacher"),
      ),
    ).rejects.toThrow();
  });

  it("hides answer keys from a student listing", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const seeded = await seedTaxonomy();

    await questionService.create(
      { ...payload(seeded), status: "APPROVED" },
      actorFor(seeded.teacher._id, "reviewer"),
    );

    const { items } = await questionService.list(
      {
        page: 1,
        limit: 20,
        withAnswers: true,
        sort: "newest",
        search: undefined,
        tags: undefined,
        mine: undefined,
        aiGenerated: undefined,
      },
      actorFor(seeded.other._id, "student"),
    );

    expect(items.length).toBe(1);
    expect(items[0]?.answer).toBeUndefined();
    expect(items[0]?.answersIncluded).toBe(false);
  });

  it("imports in bulk and reports per-item failures", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const seeded = await seedTaxonomy();
    const admin = actorFor(seeded.teacher._id, "super_admin");

    const good = payload(seeded);
    const duplicate = payload(seeded);
    const badHierarchy = {
      ...payload(seeded),
      subject: seeded.otherSubject._id.toString(),
      question: { ...good.question, text: "A different question entirely" },
    };

    const result = await questionService.bulkCreate([good, duplicate, badHierarchy], admin);

    expect(result.received).toBe(3);
    expect(result.inserted).toBe(1);
    expect(result.failed).toBe(2);
    expect(result.errors.map((error) => error.index).sort()).toEqual([1, 2]);
  });
});
