import { describe, expect, it } from "vitest";

import { registerSchema } from "@/lib/validation/auth.schema";
import {
  bulkCreateQuestionSchema,
  createQuestionSchema,
  MAX_BULK_ITEMS,
  questionListQuerySchema,
} from "@/lib/validation/question.schema";

function validQuestion(overrides: Record<string, unknown> = {}) {
  return {
    category: "507f1f77bcf86cd799439011",
    subject: "507f1f77bcf86cd799439012",
    chapter: "507f1f77bcf86cd799439013",
    type: "MCQ",
    question: { text: "What is the SI unit of force?" },
    options: [
      { id: "a", text: "Newton" },
      { id: "b", text: "Joule" },
    ],
    answer: { correctOptions: ["a"] },
    ...overrides,
  };
}

describe("registration schema", () => {
  it("strips a client-supplied role", () => {
    const parsed = registerSchema.parse({
      name: "Mallory",
      email: "mallory@example.com",
      password: "Correct horse battery 7! staple",
      confirmPassword: "Correct horse battery 7! staple",
      role: "super_admin",
    });

    // Zod objects strip unknown keys by default, so `role` cannot reach the
    // service. This was the previous project's privilege-escalation path.
    expect("role" in parsed).toBe(false);
  });

  it("rejects mismatched confirmation and weak passwords", () => {
    expect(
      registerSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: "correct horse battery staple",
        confirmPassword: "something else",
      }).success,
    ).toBe(false);

    expect(
      registerSchema.safeParse({
        name: "Ada",
        email: "ada@example.com",
        password: "short",
        confirmPassword: "short",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      registerSchema.safeParse({
        name: "Ada",
        email: "not-an-email",
        password: "correct horse battery staple",
        confirmPassword: "correct horse battery staple",
      }).success,
    ).toBe(false);
  });
});

describe("question schema", () => {
  it("strips createdBy from the payload", () => {
    const parsed = createQuestionSchema.parse(
      validQuestion({ createdBy: "507f1f77bcf86cd799439099" }),
    );
    expect("createdBy" in parsed).toBe(false);
  });

  it("rejects malformed ObjectIds", () => {
    expect(createQuestionSchema.safeParse(validQuestion({ chapter: "nope" })).success).toBe(false);
  });

  it("rejects an unknown question type", () => {
    expect(createQuestionSchema.safeParse(validQuestion({ type: "TELEPATHY" })).success).toBe(false);
  });

  it("rejects oversized text", () => {
    expect(
      createQuestionSchema.safeParse(validQuestion({ question: { text: "x".repeat(6000) } })).success,
    ).toBe(false);
  });

  it("uppercases option ids and correct options", () => {
    const parsed = createQuestionSchema.parse(validQuestion());
    expect(parsed.options[0]?.id).toBe("A");
    expect(parsed.answer.correctOptions).toEqual(["A"]);
  });

  it("defaults status to DRAFT", () => {
    expect(createQuestionSchema.parse(validQuestion()).status).toBe("DRAFT");
  });
});

describe("bulk schema", () => {
  it("accepts exactly the maximum item count", () => {
    const payload = { questions: Array.from({ length: MAX_BULK_ITEMS }, () => validQuestion()) };
    expect(bulkCreateQuestionSchema.safeParse(payload).success).toBe(true);
  });

  it("rejects more than the maximum", () => {
    const payload = { questions: Array.from({ length: MAX_BULK_ITEMS + 1 }, () => validQuestion()) };
    expect(bulkCreateQuestionSchema.safeParse(payload).success).toBe(false);
  });

  it("rejects an empty array", () => {
    expect(bulkCreateQuestionSchema.safeParse({ questions: [] }).success).toBe(false);
  });

  it("strips a client-supplied organizationId from every row", () => {
    const parsed = bulkCreateQuestionSchema.parse({
      questions: [validQuestion({ organizationId: "507f1f77bcf86cd799439099" })],
    });
    expect(parsed.questions[0]).not.toHaveProperty("organizationId");
  });
});

describe("question list query", () => {
  it("caps the limit and falls back on nonsense", () => {
    expect(questionListQuerySchema.parse({ limit: "1000000" }).limit).toBe(20);
    expect(questionListQuerySchema.parse({ limit: "100" }).limit).toBe(100);
  });

  it("rejects an invalid enum value", () => {
    expect(questionListQuerySchema.safeParse({ type: "NOPE" }).success).toBe(false);
  });

  it("parses withAnswers as a request, not a grant", () => {
    expect(questionListQuerySchema.parse({ withAnswers: "true" }).withAnswers).toBe(true);
  });
});
