import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";

/**
 * AI Generated Questions — organization isolation and the generate → import
 * contract. The question-generation Ollama call itself is mocked; everything downstream (taxonomy
 * validation, duplicate detection, persistence, metadata, permissions) is
 * exercised for real against an in-memory MongoDB.
 */

const { generateJsonMock } = vi.hoisted(() => ({ generateJsonMock: vi.fn() }));

vi.mock("@/lib/ai/question-generation-ollama", () => ({
  questionGenerationOllamaClient: {
    enabled: true,
    model: "ollama-generation-test",
    generateJson: generateJsonMock,
  },
  QuestionGenerationUnavailableError: class QuestionGenerationUnavailableError extends Error {},
}));

const harness = await startDatabase();
const available = harness !== null;

afterAll(async () => {
  await harness?.stop();
});

beforeEach(async () => {
  if (available) await clearCollections();
  generateJsonMock.mockReset();
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

interface OrgTaxonomy {
  orgId: Types.ObjectId;
  category: Types.ObjectId;
  subject: Types.ObjectId;
  chapter: Types.ObjectId;
  topic: Types.ObjectId;
}

async function seedOrg(slug: string): Promise<OrgTaxonomy> {
  const { Organization, Category, Subject, Chapter, Topic } = await import("@/models");

  const org = await Organization.create({ name: `${slug} Org`, slug, isActive: true });
  const category = await Category.create({
    organizationId: org._id,
    name: `${slug} Class 8`,
    slug: `${slug}-cat`,
  });
  const subject = await Subject.create({
    organizationId: org._id,
    name: `${slug} Science`,
    slug: `${slug}-sub`,
    category: category._id,
  });
  const chapter = await Chapter.create({
    organizationId: org._id,
    name: `${slug} Force and Motion`,
    slug: `${slug}-chap`,
    category: category._id,
    subject: subject._id,
  });
  const topic = await Topic.create({
    organizationId: org._id,
    name: `${slug} Friction`,
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
  role: "organization_owner" | "team_admin" | "teacher" = "teacher",
): Promise<void> {
  const { OrganizationMember } = await import("@/models");
  await OrganizationMember.create({ userId, organizationId, role, status: "active" });
}

function rawMcq(text: string, answerText = "Newton") {
  return {
    text,
    type: "MCQ",
    options: ["Joule", "Newton", "Watt", "Pascal"],
    answer: [answerText],
    difficulty: "MEDIUM",
    marks: 1,
    explanation: "Newton is the SI unit of force.",
  };
}

function generateInput(tax: OrgTaxonomy, overrides: Record<string, unknown> = {}) {
  return {
    category: tax.category.toString(),
    subject: tax.subject.toString(),
    chapter: tax.chapter.toString(),
    topic: tax.topic.toString(),
    type: "MCQ" as const,
    difficulty: "MEDIUM" as const,
    language: "en" as const,
    count: 10,
    instruction: "",
    ...overrides,
  };
}

function normalisedItem(text: string) {
  return {
    type: "MCQ" as const,
    difficulty: "MEDIUM" as const,
    question: { text },
    options: [
      { id: "A", text: "Joule" },
      { id: "B", text: "Newton" },
      { id: "C", text: "Watt" },
      { id: "D", text: "Pascal" },
    ],
    answer: { text: "", correctOptions: ["B"], booleanAnswer: null },
    explanation: "Newton is the SI unit of force.",
    marks: 1,
  };
}

describe.skipIf(!available)("AI question generation — organization isolation", () => {
  it("generates candidates scoped to the caller's organization, with resolved taxonomy names", async () => {
    const { aiQuestionService } = await import("@/lib/services/ai-question.service");
    const { User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    await seedOrg("beta");
    const author = await User.create({ name: "Teacher", email: "t@example.com", password: "x", role: "teacher" });
    await addMember(author._id, orgA.orgId);

    generateJsonMock.mockResolvedValue({
      questions: [rawMcq("What is the SI unit of force?"), rawMcq("Which quantity is a vector?", "Newton")],
    });

    const result = await aiQuestionService.generate(
      generateInput(orgA),
      actorFor(author._id, "teacher", orgA.orgId.toString()),
    );

    expect(result.organizationId).toBe(orgA.orgId.toString());
    expect(result.taxonomy.chapterName).toBe("alpha Force and Motion");
    expect(result.generated).toBe(2);
    expect(result.newCount).toBe(2);
    expect(result.questions.every((q) => q.question.type === "MCQ")).toBe(true);
    // Nothing was written by a generate call.
    const { Question } = await import("@/models");
    expect(await Question.countDocuments({})).toBe(0);
  });

  it("flags a duplicate from the caller's org but ignores an identical question in another org", async () => {
    const { aiQuestionService } = await import("@/lib/services/ai-question.service");
    const { questionContentHash } = await import("@/lib/security/hash");
    const { Question, User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const orgB = await seedOrg("beta");
    const author = await User.create({ name: "Teacher", email: "t@example.com", password: "x", role: "teacher" });
    await addMember(author._id, orgA.orgId);

    const sharedText = "What is the SI unit of force?";

    // Same text exists in BOTH orgs' banks.
    const existingA = await Question.create({
      organizationId: orgA.orgId,
      category: orgA.category,
      subject: orgA.subject,
      chapter: orgA.chapter,
      type: "MCQ",
      language: "en",
      question: { text: sharedText },
      options: [
        { id: "A", text: "Joule" },
        { id: "B", text: "Newton" },
      ],
      answer: { correctOptions: ["B"] },
      contentHash: questionContentHash(orgA.chapter.toString(), sharedText),
      createdBy: author._id,
      status: "APPROVED",
    });
    await Question.create({
      organizationId: orgB.orgId,
      category: orgB.category,
      subject: orgB.subject,
      chapter: orgB.chapter,
      type: "MCQ",
      language: "en",
      question: { text: sharedText },
      options: [
        { id: "A", text: "Joule" },
        { id: "B", text: "Newton" },
      ],
      answer: { correctOptions: ["B"] },
      contentHash: questionContentHash(orgB.chapter.toString(), sharedText),
      createdBy: author._id,
      status: "APPROVED",
    });

    generateJsonMock.mockResolvedValue({
      questions: [rawMcq(sharedText), rawMcq("A brand new question about momentum?")],
    });

    const result = await aiQuestionService.generate(
      generateInput(orgA),
      actorFor(author._id, "teacher", orgA.orgId.toString()),
    );

    expect(result.questions[0]?.status).toBe("duplicate");
    expect(result.questions[0]?.duplicateOf).toBe(existingA._id.toString());
    expect(result.questions[1]?.status).toBe("new");
    expect(result.duplicateCount).toBe(1);
  });

  it("marks structurally invalid AI output as needs_review", async () => {
    const { aiQuestionService } = await import("@/lib/services/ai-question.service");
    const { User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const author = await User.create({ name: "Teacher", email: "t@example.com", password: "x", role: "teacher" });
    await addMember(author._id, orgA.orgId);

    generateJsonMock.mockResolvedValue({
      questions: [
        { text: "Broken question", type: "MCQ", options: ["only one"], answer: [], difficulty: "MEDIUM", marks: 1 },
      ],
    });

    const result = await aiQuestionService.generate(
      generateInput(orgA),
      actorFor(author._id, "teacher", orgA.orgId.toString()),
    );

    expect(result.questions[0]?.status).toBe("needs_review");
    expect(result.questions[0]?.issues.length).toBeGreaterThan(0);
    expect(result.needsReviewCount).toBe(1);
  });

  it("refuses generation for a role without question:generate-ai", async () => {
    const { aiQuestionService } = await import("@/lib/services/ai-question.service");
    const { User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const student = await User.create({ name: "Student", email: "s@example.com", password: "x", role: "student" });
    await addMember(student._id, orgA.orgId);

    await expect(
      aiQuestionService.generate(generateInput(orgA), actorFor(student._id, "student", orgA.orgId.toString())),
    ).rejects.toThrow();
    expect(generateJsonMock).not.toHaveBeenCalled();
  });
});

describe.skipIf(!available)("AI question import", () => {
  it("persists selected questions into the caller's org as DRAFT with AI metadata", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question, User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const author = await User.create({ name: "Teacher", email: "t@example.com", password: "x", role: "teacher" });
    await addMember(author._id, orgA.orgId);

    const result = await questionService.aiImport(
      {
        category: orgA.category.toString(),
        subject: orgA.subject.toString(),
        chapter: orgA.chapter.toString(),
        topic: orgA.topic.toString(),
        language: "en",
        questions: [normalisedItem("Imported AI question one"), normalisedItem("Imported AI question two")],
      },
      actorFor(author._id, "teacher", orgA.orgId.toString()),
    );

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);

    const stored = await Question.find({}).lean().exec();
    expect(stored).toHaveLength(2);
    for (const question of stored) {
      expect(question.organizationId.toString()).toBe(orgA.orgId.toString());
      expect(question.source).toBe("AI_GENERATED");
      expect(question.aiGenerated).toBe(true);
      expect(question.status).toBe("DRAFT");
      expect(question.tags).toContain("ai-generated");
      expect(question.topic?.toString()).toBe(orgA.topic.toString());
    }
  });

  it("rejects an import that references another organization's taxonomy", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question, User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const orgB = await seedOrg("beta");
    const author = await User.create({ name: "Teacher", email: "t@example.com", password: "x", role: "teacher" });
    await addMember(author._id, orgA.orgId);

    await expect(
      questionService.aiImport(
        {
          category: orgA.category.toString(),
          subject: orgB.subject.toString(),
          chapter: orgB.chapter.toString(),
          topic: null,
          language: "en",
          questions: [normalisedItem("Cross-tenant import")],
        },
        actorFor(author._id, "teacher", orgA.orgId.toString()),
      ),
    ).rejects.toThrow(/taxonomy/i);

    expect(await Question.countDocuments({})).toBe(0);
  });

  it("skips a duplicate instead of inserting it twice", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { Question, User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const author = await User.create({ name: "Teacher", email: "t@example.com", password: "x", role: "teacher" });
    await addMember(author._id, orgA.orgId);

    const placement = {
      category: orgA.category.toString(),
      subject: orgA.subject.toString(),
      chapter: orgA.chapter.toString(),
      topic: orgA.topic.toString(),
      language: "en" as const,
    };

    const first = await questionService.aiImport(
      { ...placement, questions: [normalisedItem("Repeated question")] },
      actorFor(author._id, "teacher", orgA.orgId.toString()),
    );
    expect(first.imported).toBe(1);

    const second = await questionService.aiImport(
      { ...placement, questions: [normalisedItem("Repeated question")] },
      actorFor(author._id, "teacher", orgA.orgId.toString()),
    );
    expect(second.imported).toBe(0);
    expect(second.skipped).toBe(1);
    expect(JSON.stringify(second.errors)).toMatch(/already exists/i);
    expect(await Question.countDocuments({})).toBe(1);
  });

  it("refuses import for a role without question:import", async () => {
    const { questionService } = await import("@/lib/services/question.service");
    const { User } = await import("@/models");

    const orgA = await seedOrg("alpha");
    const student = await User.create({ name: "Student", email: "s@example.com", password: "x", role: "student" });
    await addMember(student._id, orgA.orgId);

    await expect(
      questionService.aiImport(
        {
          category: orgA.category.toString(),
          subject: orgA.subject.toString(),
          chapter: orgA.chapter.toString(),
          topic: null,
          language: "en",
          questions: [normalisedItem("nope")],
        },
        actorFor(student._id, "student", orgA.orgId.toString()),
      ),
    ).rejects.toThrow();
  });
});
