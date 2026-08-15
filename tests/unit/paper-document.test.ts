import { describe, expect, it } from "vitest";
import { Types } from "mongoose";

import { buildRenderedPaper, formatAnswer } from "@/lib/export/paper-document";
import type { PaperDoc } from "@/lib/repositories/paper.repo";

/**
 * The rendered document decides what reaches PDF and DOCX. The student variant
 * must never carry an answer or an explanation, whatever the loaded document
 * happens to contain.
 */

function paperWith(overrides: Partial<PaperDoc> = {}): PaperDoc {
  return {
    _id: new Types.ObjectId(),
    title: "Physics Half Yearly",
    description: "",
    instructions: "Answer all questions.",
    category: { name: "Class 9-10" },
    subject: { name: "Physics" },
    board: { name: "Dhaka Board" },
    exam: null,
    year: 2024,
    mode: "MANUAL",
    status: "DRAFT",
    durationMinutes: 90,
    totalMarks: 3,
    totalQuestions: 2,
    sections: [
      {
        title: "Section A",
        instructions: "",
        order: 0,
        questions: [
          {
            order: 0,
            marks: 1,
            note: "",
            question: {
              question: { text: "What is the SI unit of force?" },
              options: [
                { id: "A", text: "Newton" },
                { id: "B", text: "Joule" },
              ],
              answer: { correctOptions: ["A"], text: "", booleanAnswer: null, matchingPairs: [] },
              explanation: "Force is measured in newtons.",
              type: "MCQ",
              difficulty: "EASY",
            },
          },
          {
            order: 1,
            marks: 2,
            note: "",
            question: {
              question: { text: "State Newton's second law." },
              options: [],
              answer: { correctOptions: [], text: "F = ma", booleanAnswer: null, matchingPairs: [] },
              explanation: "",
              type: "SHORT",
              difficulty: "MEDIUM",
            },
          },
        ],
      },
    ],
    generationSpec: null,
    version: 1,
    versionHistory: [],
    clonedFrom: null,
    createdBy: new Types.ObjectId(),
    updatedBy: null,
    publishedBy: null,
    publishedAt: null,
    archivedAt: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as unknown as PaperDoc;
}

describe("formatAnswer", () => {
  const options = [
    { label: "A", text: "Newton" },
    { label: "B", text: "Joule" },
  ];

  it("renders correct options with their text", () => {
    expect(
      formatAnswer(
        { correctOptions: ["A"], text: "", booleanAnswer: null, matchingPairs: [] },
        options,
      ),
    ).toContain("Newton");
  });

  it("renders a boolean answer", () => {
    expect(
      formatAnswer(
        { correctOptions: [], text: "", booleanAnswer: false, matchingPairs: [] },
        options,
      ),
    ).toBe("False");
  });

  it("renders matching pairs", () => {
    const result = formatAnswer(
      {
        correctOptions: [],
        text: "",
        booleanAnswer: null,
        matchingPairs: [{ left: "Solid", right: "Fixed shape" }],
      },
      options,
    );
    expect(result).toContain("Solid");
    expect(result).toContain("Fixed shape");
  });

  it("returns an empty string for a missing answer", () => {
    expect(formatAnswer(undefined, options)).toBe("");
  });
});

describe("buildRenderedPaper", () => {
  it("omits answers and explanations from the student variant", () => {
    const rendered = buildRenderedPaper(paperWith(), "student");
    const questions = rendered.sections.flatMap((section) => section.questions);

    expect(questions).toHaveLength(2);
    for (const question of questions) {
      expect(question.answer).toBeNull();
      expect(question.explanation).toBeNull();
    }
  });

  it("includes answers and explanations in the teacher variant", () => {
    const rendered = buildRenderedPaper(paperWith(), "teacher");
    const questions = rendered.sections.flatMap((section) => section.questions);

    expect(questions[0]?.answer).toContain("Newton");
    expect(questions[0]?.explanation).toContain("newtons");
    expect(rendered.subtitle).toContain("Teacher copy");
  });

  it("numbers questions continuously across sections", () => {
    const rendered = buildRenderedPaper(paperWith(), "student");
    const numbers = rendered.sections.flatMap((section) =>
      section.questions.map((question) => question.number),
    );
    expect(numbers).toEqual([1, 2]);
  });

  it("computes section marks and a type-level mark distribution", () => {
    const rendered = buildRenderedPaper(paperWith(), "student");

    expect(rendered.sections[0]?.sectionMarks).toBe(3);
    expect(rendered.marksByType.reduce((sum, row) => sum + row.marks, 0)).toBe(3);
    expect(rendered.marksByType.reduce((sum, row) => sum + row.count, 0)).toBe(2);
  });

  it("builds a metadata block from populated references", () => {
    const rendered = buildRenderedPaper(paperWith(), "student");
    const labels = rendered.meta.map((entry) => entry.label);

    expect(labels).toContain("Subject");
    expect(labels).toContain("Board");
    expect(labels).toContain("Full marks");
  });

  it("degrades gracefully when a referenced question is missing", () => {
    const broken = paperWith();
    broken.sections[0]!.questions[0]!.question = null as never;

    const rendered = buildRenderedPaper(broken, "student");
    expect(rendered.sections[0]?.questions[0]?.text).toContain("unavailable");
  });
});
