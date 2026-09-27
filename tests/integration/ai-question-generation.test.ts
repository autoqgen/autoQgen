import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

import { clearCollections, startDatabase } from "./db";
import type { AuthContext } from "@/lib/auth/session";
import type { UserRole } from "@/types/roles";
import type { OrgRole } from "@/types/organization";

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
  role: OrgRole = "teacher",
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

function rawCreativeGroup() {
  const questions = [
    "সুমাইয়ার লবণ-পানির দ্রবণে পানি কোন ভূমিকা পালন করছে? দ্রাবক কী?",
    "প্রথমে লবণ অদৃশ্য হয়ে দ্রবণটি সমসত্ত্ব হলো কেন?",
    "সুমাইয়ার গ্লাসে আর লবণ না মেশার কারণ পরীক্ষার ঘটনা দিয়ে ব্যাখ্যা কর।",
    "সুমাইয়া পানি বাড়ালে অবদ্রবীভূত লবণের কী পরিবর্তন হবে? যুক্তিসহ বিশ্লেষণ কর।",
  ];
  const answers = [
    "যে পদার্থে অন্য পদার্থ দ্রবীভূত হয় তাকে দ্রাবক বলে। সুমাইয়ার পরীক্ষায় পানি হলো দ্রাবক।",
    "লবণ পানিতে দ্রবীভূত হয়ে দ্রবণের সব অংশে সমানভাবে ছড়িয়ে পড়ে। তাই এর গঠন সর্বত্র একই থাকে এবং এটি সমসত্ত্ব মিশ্রণ।",
    "নির্দিষ্ট তাপমাত্রায় পানিতে সর্বোচ্চ পরিমাণ লবণ দ্রবীভূত হয়েছে। দ্রবণটি সম্পৃক্ত হওয়ায় অতিরিক্ত লবণ আর মিশতে পারেনি এবং নিচে জমেছে।",
    "পানির পরিমাণ বাড়লে দ্রাবকের পরিমাণ বাড়বে এবং আরও লবণ দ্রবীভূত হতে পারবে। ফলে নিচে জমে থাকা লবণের একটি অংশ বা সবটুকু মিশে যেতে পারে, তাই দ্রবীভূত লবণের পরিমাণ বাড়বে।",
  ];
  return {
    stimulus: "সুমাইয়া একটি গ্লাস পানিতে এক চামচ লবণ দিয়ে নাড়ল। লবণ অদৃশ্য হলো। পরে আরও কয়েক চামচ লবণ দিলে কিছু লবণ আর না মিশে নিচে জমে থাকল।",
    parts: questions.map((text, index) => ({
      label: ["ক", "খ", "গ", "ঘ"][index],
      cognitiveLevel: ["knowledge", "understanding", "application", "higher_order"][index],
      marks: index + 1,
      type: "WRITTEN",
      text,
      options: [],
      answer: [answers[index]],
      difficulty: index === 0 ? "EASY" : "MEDIUM",
      explanation: answers[index],
    })),
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
  it("regenerates malformed CQ JSON instead of returning it as a successful result", async () => {
    const { aiQuestionService } = await import("@/lib/services/ai-question.service");
    const { User } = await import("@/models");
    const org = await seedOrg("cq-json");
    const author = await User.create({
      name: "CQ Teacher",
      email: "cq-json@example.com",
      password: "x",
      role: "teacher",
    });
    await addMember(author._id, org.orgId);
    generateJsonMock
      .mockRejectedValueOnce(new Error("The AI service returned malformed JSON."))
      .mockResolvedValueOnce(rawCreativeGroup())
      .mockResolvedValueOnce({ pass: true, issues: [], partIssues: [[], [], [], []] });

    const result = await aiQuestionService.generateCreativeGroup(
      {
        category: org.category.toString(),
        subject: org.subject.toString(),
        chapter: org.chapter.toString(),
        topic: org.topic.toString(),
        difficulty: null,
        language: "bn",
        instruction: "",
      },
      actorFor(author._id, "teacher", org.orgId.toString()),
    );

    expect(result.issues).toEqual([]);
    expect(result.qualityAttempts).toBe(2);
    expect(result.parts).toHaveLength(4);
    expect(generateJsonMock).toHaveBeenCalledTimes(3);
    expect(generateJsonMock.mock.calls[1]?.[0].prompt).toContain("malformed JSON");
  });

  it("retries a CQ rejected for weak stimulus connection and returns the reviewed version", async () => {
    const { aiQuestionService } = await import("@/lib/services/ai-question.service");
    const { User } = await import("@/models");
    const org = await seedOrg("cq-review");
    const author = await User.create({
      name: "CQ Teacher",
      email: "cq-review@example.com",
      password: "x",
      role: "teacher",
    });
    await addMember(author._id, org.orgId);
    const first = rawCreativeGroup();
    first.parts[2]!.text = "দ্রাব্যতা কী?";
    const corrected = rawCreativeGroup();
    generateJsonMock
      .mockResolvedValueOnce(first)
      .mockResolvedValueOnce({
        pass: false,
        issues: ["Part গ is generic and does not explain the undissolved salt in the stimulus."],
        partIssues: [[], [], ["Connect the explanation to the salt remaining at the bottom."], []],
      })
      .mockResolvedValueOnce(corrected)
      .mockResolvedValueOnce({ pass: true, issues: [], partIssues: [[], [], [], []] });

    const result = await aiQuestionService.generateCreativeGroup(
      {
        category: org.category.toString(),
        subject: org.subject.toString(),
        chapter: org.chapter.toString(),
        topic: org.topic.toString(),
        difficulty: null,
        language: "bn",
        instruction: "",
      },
      actorFor(author._id, "teacher", org.orgId.toString()),
    );

    expect(result.issues).toEqual([]);
    expect(result.qualityAttempts).toBe(2);
    expect(result.parts).toHaveLength(4);
    expect(result.parts.map((part) => part.question.marks)).toEqual([1, 2, 3, 4]);
    expect(result.parts[2]?.question.question.text).toContain("আর লবণ না মেশার কারণ");
    expect(generateJsonMock).toHaveBeenCalledTimes(4);
    expect(generateJsonMock.mock.calls[2]?.[0].prompt).toContain("does not explain the undissolved salt");
  });

  it("does not clear the quality gate when repeated CQ attempts fail review", async () => {
    const { aiQuestionService } = await import("@/lib/services/ai-question.service");
    const { User } = await import("@/models");
    const org = await seedOrg("cq-rejected");
    const author = await User.create({
      name: "CQ Teacher",
      email: "cq-rejected@example.com",
      password: "x",
      role: "teacher",
    });
    await addMember(author._id, org.orgId);
    generateJsonMock
      .mockResolvedValueOnce(rawCreativeGroup())
      .mockResolvedValueOnce({ pass: false, issues: ["Part ঘ is unrelated to the scenario."], partIssues: [[], [], [], ["Connect the analysis to the scenario."]] })
      .mockResolvedValueOnce(rawCreativeGroup())
      .mockResolvedValueOnce({ pass: false, issues: ["Part ঘ remains generic."], partIssues: [[], [], [], ["Make a scenario-specific prediction."]] })
      .mockResolvedValueOnce(rawCreativeGroup())
      .mockResolvedValueOnce({ pass: false, issues: ["The same stimulus-to-question issue remains."], partIssues: [[], [], [], ["Use evidence from the stimulus."]] });

    const result = await aiQuestionService.generateCreativeGroup(
      {
        category: org.category.toString(),
        subject: org.subject.toString(),
        chapter: org.chapter.toString(),
        topic: org.topic.toString(),
        difficulty: null,
        language: "bn",
        instruction: "",
      },
      actorFor(author._id, "teacher", org.orgId.toString()),
    );

    expect(result.qualityAttempts).toBe(3);
    expect(result.issues).toContain("Part ঘ: Use evidence from the stimulus.");
    expect(generateJsonMock).toHaveBeenCalledTimes(6);
  });

  it("rejects an incomplete reviewer approval and retries the CQ", async () => {
    const { aiQuestionService } = await import("@/lib/services/ai-question.service");
    const { User } = await import("@/models");
    const org = await seedOrg("cq-review-shape");
    const author = await User.create({
      name: "CQ Teacher",
      email: "cq-review-shape@example.com",
      password: "x",
      role: "teacher",
    });
    await addMember(author._id, org.orgId);
    generateJsonMock
      .mockResolvedValueOnce(rawCreativeGroup())
      .mockResolvedValueOnce({ pass: true, issues: [] })
      .mockResolvedValueOnce(rawCreativeGroup())
      .mockResolvedValueOnce({ pass: true, issues: [], partIssues: [[], [], [], []] });

    const result = await aiQuestionService.generateCreativeGroup(
      {
        category: org.category.toString(),
        subject: org.subject.toString(),
        chapter: org.chapter.toString(),
        topic: org.topic.toString(),
        difficulty: null,
        language: "bn",
        instruction: "",
      },
      actorFor(author._id, "teacher", org.orgId.toString()),
    );

    expect(result.qualityAttempts).toBe(2);
    expect(result.issues).toEqual([]);
    expect(generateJsonMock).toHaveBeenCalledTimes(4);
    expect(generateJsonMock.mock.calls[2]?.[0].prompt).toContain("complete, valid approval");
  });

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
    await addMember(student._id, orgA.orgId, "student");

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
    await addMember(student._id, orgA.orgId, "student");

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
