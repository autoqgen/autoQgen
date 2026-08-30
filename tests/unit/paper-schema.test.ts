import { describe, expect, it } from "vitest";

import {
  createPaperSchema,
  generatePaperSchema,
  MAX_QUESTIONS_PER_PAPER,
  paperActionSchema,
  paperExportQuerySchema,
  paperListQuerySchema,
} from "@/lib/validation/paper.schema";

const OID = "507f1f77bcf86cd799439011";

function baseSpec(overrides: Record<string, unknown> = {}) {
  return {
    category: OID,
    subject: OID,
    chapters: [OID],
    totalQuestions: 10,
    ...overrides,
  };
}

describe("createPaperSchema", () => {
  it("strips server-derived fields", () => {
    const parsed = createPaperSchema.parse({
      title: "Half yearly",
      category: OID,
      subject: OID,
      createdBy: OID,
      totalMarks: 999,
      status: "PUBLISHED",
      version: 42,
    });

    // None of these may ever come from a client.
    expect("createdBy" in parsed).toBe(false);
    expect("totalMarks" in parsed).toBe(false);
    expect("status" in parsed).toBe(false);
    expect("version" in parsed).toBe(false);
  });

  it("rejects a missing title and malformed ids", () => {
    expect(createPaperSchema.safeParse({ category: OID, subject: OID }).success).toBe(false);
    expect(
      createPaperSchema.safeParse({ title: "x", category: "nope", subject: OID }).success,
    ).toBe(false);
  });
});

describe("generatePaperSchema", () => {
  it("accepts a well-formed blueprint", () => {
    expect(generatePaperSchema.safeParse(baseSpec()).success).toBe(true);
  });

  it("requires at least one chapter", () => {
    expect(generatePaperSchema.safeParse(baseSpec({ chapters: [] })).success).toBe(false);
  });

  it("rejects difficulty quotas that exceed the total", () => {
    const result = generatePaperSchema.safeParse(
      baseSpec({
        totalQuestions: 5,
        difficultyDistribution: [
          { difficulty: "EASY", count: 4 },
          { difficulty: "HARD", count: 4 },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects type quotas that exceed the total", () => {
    const result = generatePaperSchema.safeParse(
      baseSpec({ totalQuestions: 3, typeDistribution: [{ type: "MCQ", count: 9 }] }),
    );
    expect(result.success).toBe(false);
  });

  it("rejects a repeated difficulty", () => {
    const result = generatePaperSchema.safeParse(
      baseSpec({
        difficultyDistribution: [
          { difficulty: "EASY", count: 1 },
          { difficulty: "EASY", count: 1 },
        ],
      }),
    );
    expect(result.success).toBe(false);
  });

  it("caps totalQuestions at the paper maximum", () => {
    expect(
      generatePaperSchema.safeParse(baseSpec({ totalQuestions: MAX_QUESTIONS_PER_PAPER + 1 }))
        .success,
    ).toBe(false);
  });

  it("defaults to selecting only approved questions", () => {
    const parsed = generatePaperSchema.parse(baseSpec());
    expect(parsed.status).toBe("APPROVED");
  });

  it("refuses to widen the pool beyond APPROVED", () => {
    for (const status of ["PENDING", "DRAFT", "REJECTED"]) {
      expect(generatePaperSchema.safeParse(baseSpec({ status })).success).toBe(false);
    }
    expect(generatePaperSchema.safeParse(baseSpec({ status: "APPROVED" })).success).toBe(true);
  });
});

describe("paper queries", () => {
  it("caps the list page size like every other list endpoint", () => {
    expect(paperListQuerySchema.parse({ limit: "1000000" }).limit).toBe(20);
    expect(paperListQuerySchema.parse({ limit: "100" }).limit).toBe(100);
  });

  it("falls back to safe export defaults on nonsense input", () => {
    const parsed = paperExportQuerySchema.parse({ format: "exe", variant: "root" });
    expect(parsed.format).toBe("pdf");
    // Defaulting to the student copy means a malformed request never leaks answers.
    expect(parsed.variant).toBe("student");
  });

  it("restricts lifecycle actions to the known set", () => {
    expect(paperActionSchema.safeParse({ action: "publish" }).success).toBe(true);
    expect(paperActionSchema.safeParse({ action: "destroy" }).success).toBe(false);
  });
});
