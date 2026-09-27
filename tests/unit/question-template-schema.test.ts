import { describe, expect, it } from "vitest";

import {
  createQuestionTemplateSchema,
  templateGenerationSpecSchema,
} from "@/lib/validation/question-template.schema";
import { DEFAULT_PAPER_DESIGN } from "@/lib/validation/paper.schema";

describe("templateGenerationSpecSchema", () => {
  it("accepts an empty pattern and fills safe defaults", () => {
    const parsed = templateGenerationSpecSchema.parse({});
    expect(parsed.category).toBeNull();
    expect(parsed.subject).toBeNull();
    expect(parsed.chapters).toEqual([]);
    expect(parsed.totalQuestions).toBe(10);
    expect(parsed.paperType).toBe("OTHER");
    expect(parsed.status).toBe("APPROVED");
    expect(parsed.randomize.selection).toBe(true);
  });

  it("keeps taxonomy optional but validates ids when present", () => {
    const ok = templateGenerationSpecSchema.parse({ subject: "0123456789abcdef01234567" });
    expect(ok.subject).toBe("0123456789abcdef01234567");
    expect(() => templateGenerationSpecSchema.parse({ subject: "not-an-id" })).toThrow();
  });

  it("still enforces the distribution sum checks", () => {
    expect(() =>
      templateGenerationSpecSchema.parse({
        totalQuestions: 10,
        typeDistribution: [{ type: "MCQ", count: 20 }],
      }),
    ).toThrow(/exceeds totalQuestions/);
  });

  it("preserves Admission subjects and requires their percentages to total 100", () => {
    const subject = "0123456789abcdef01234567";
    const secondSubject = "1123456789abcdef01234567";
    const parsed = templateGenerationSpecSchema.parse({
      paperType: "ADMISSION",
      admissionSubjects: [
        { subject, percentage: 20 },
        { subject: secondSubject, percentage: 80 },
      ],
    });
    expect(parsed.admissionSubjects.map((entry) => entry.percentage)).toEqual([20, 80]);
    expect(() => templateGenerationSpecSchema.parse({
      admissionSubjects: [
        { subject, percentage: 20 },
        { subject: secondSubject, percentage: 70 },
      ],
    })).toThrow(/total 100%/);
    expect(() => templateGenerationSpecSchema.parse({ paperType: "ADMISSION" }))
      .toThrow(/at least one Admission subject/);
  });

  it("rejects a question that is both mandatory and excluded", () => {
    const id = "0123456789abcdef01234567";
    expect(() =>
      templateGenerationSpecSchema.parse({
        mandatoryQuestionIds: [id],
        excludedQuestionIds: [id],
      }),
    ).toThrow(/both mandatory and excluded/);
  });
});

describe("createQuestionTemplateSchema", () => {
  it("requires a name and a design config", () => {
    expect(() =>
      createQuestionTemplateSchema.parse({ generationSpec: {}, designConfig: DEFAULT_PAPER_DESIGN }),
    ).toThrow();

    const parsed = createQuestionTemplateSchema.parse({
      name: "Class 8 Model Test",
      generationSpec: {},
      designConfig: {},
    });
    expect(parsed.name).toBe("Class 8 Model Test");
    expect(parsed.description).toBe("");
    // paperDesignSchema fills its own defaults (English heading, etc.).
    expect(parsed.designConfig.heading.language).toBe("en");
  });
});
