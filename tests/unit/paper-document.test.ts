import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { PDFDocument } from "pdf-lib";
import { inflateSync } from "node:zlib";

import { buildRenderedPaper, formatAnswer } from "@/lib/export/paper-document";
import { renderPaperPdf } from "@/lib/export/pdf";
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

function isPdfContentStream(value: unknown): value is { getContents(): Uint8Array } {
  if (!value || typeof value !== "object" || !("getContents" in value)) return false;
  return typeof value.getContents === "function";
}

async function pdfPageContent(bytes: Uint8Array, pageIndex: number) {
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPages()[pageIndex]!;
  const contents = page.node.Contents();
  if (!contents) return "";

  const streams: { getContents(): Uint8Array }[] = [];
  if ("size" in contents && typeof contents.size === "function" && "lookup" in contents) {
    for (let index = 0; index < contents.size(); index += 1) {
      const stream = contents.lookup(index);
      if (isPdfContentStream(stream)) streams.push(stream);
    }
  } else if (isPdfContentStream(contents)) {
    streams.push(contents);
  }

  return streams
    .map((stream) => inflateSync(stream.getContents()).toString("latin1"))
    .join("\n");
}

async function pdfTextPositions(bytes: Uint8Array, pageIndex: number) {
  const source = await pdfPageContent(bytes, pageIndex);
  const positions: { text: string; x: number; y: number }[] = [];
  const textOperator = /1 0 0 1 ([\d.-]+) ([\d.-]+) Tm\s*<([a-f\d]+)> Tj/gi;
  for (const match of source.matchAll(textOperator)) {
    positions.push({
      x: Number(match[1]),
      y: Number(match[2]),
      text: Buffer.from(match[3]!, "hex").toString("latin1"),
    });
  }
  return positions;
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
  it("renders the header once and keeps the two-column divider below it on every page", async () => {
    const paper = paperWith({
      designConfig: {
        header: {
          showLogo: true,
          showOrganizationName: true,
          organizationName: "Organization Header",
          showOrganizationAddress: true,
          organizationAddress: "Organization address",
          programName: "Exam title",
          instructions: "HEADER_BOTTOM_SENTINEL",
        },
        studentInfo: { name: true, roll: true },
        layout: { columnCount: 2, columnGapMm: 8 },
        paper: { size: "A4", orientation: "portrait", marginMm: 12 },
      },
    });
    const questions = Array.from({ length: 18 }, (_, index) => {
      const entry = structuredClone(paper.sections[0]!.questions[0]!);
      entry.order = index;
      const source = entry.question as unknown as Record<string, unknown>;
      source.question = { text: `QUESTION_${index + 1}_MARKER ${"explanation ".repeat(35)}` };
      return entry;
    });
    paper.sections[0]!.questions = questions;
    paper.totalQuestions = questions.length;
    paper.totalMarks = questions.length;

    for (const variant of ["student", "teacher"] as const) {
      const rendered = buildRenderedPaper(paper, variant);
      const result = await renderPaperPdf(rendered);
      const pdf = await PDFDocument.load(result.bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(1);

      const pagePositions = await Promise.all(
        pdf.getPages().map((_, index) => pdfTextPositions(result.bytes, index)),
      );
      const pageContents = await Promise.all(
        pdf.getPages().map((_, index) => pdfPageContent(result.bytes, index)),
      );
      const subsequentDividerTopPositions: number[] = [];
      let sawRightColumnQuestion = false;
      for (const [pageIndex, positions] of pagePositions.entries()) {
        const headerBottom = positions.find((entry) => entry.text.includes("HEADER_BOTTOM_SENTINEL"));
        if (pageIndex === 0) {
          expect(headerBottom, "the first page should render the full header").toBeDefined();
        } else {
          expect(headerBottom, "later pages should not repeat the header").toBeUndefined();
        }

        const questionPositions = positions.filter((entry) => /QUESTION_\d+_MARKER/.test(entry.text));
        expect(questionPositions.length).toBeGreaterThan(0);
        for (const question of questionPositions) {
          if (question.x > 300) sawRightColumnQuestion = true;
        }

        const content = pageContents[pageIndex] ?? "";
        const dividerLines = Array.from(
          content.matchAll(/([-\d.]+) ([-\d.]+) m\s+([-\d.]+) ([-\d.]+) l\s+S/g),
        )
          .map((match) => ({
            x1: Number(match[1]),
            y1: Number(match[2]),
            x2: Number(match[3]),
            y2: Number(match[4]),
          }))
          .filter((line) => Math.abs(line.x1 - line.x2) < 0.01 && Math.abs(line.x1 - 297.64) < 1);
        expect(dividerLines).toHaveLength(1);
        const dividerTop = Math.max(dividerLines[0]!.y1, dividerLines[0]!.y2);
        if (pageIndex === 0) {
          expect(headerBottom).toBeDefined();
          expect(dividerTop).toBeLessThan(headerBottom!.y);
        } else {
          expect(dividerTop).toBeCloseTo(pdf.getPages()[pageIndex]!.getHeight() - 12 * (72 / 25.4), 1);
          subsequentDividerTopPositions.push(dividerTop);
        }
        for (const question of questionPositions) expect(question.y).toBeLessThan(dividerTop);
      }
      expect(sawRightColumnQuestion).toBe(true);
      expect(
        subsequentDividerTopPositions.every(
          (y) => Math.abs(y - subsequentDividerTopPositions[0]!) < 0.01,
        ),
      ).toBe(true);
    }
  });

  it("uses the saved paper size and orientation when exporting the PDF", async () => {
    const paper = paperWith({
      designConfig: {
        paper: { size: "Letter", orientation: "landscape", marginMm: 12 },
        font: { questionSize: 18 },
      },
    });
    const rendered = buildRenderedPaper(paper, "student");
    expect(rendered.design.paper.size).toBe("Letter");
    expect(rendered.design.paper.marginMm).toBe(12);

    const pdfResult = await renderPaperPdf(rendered);
    const pdf = await PDFDocument.load(pdfResult.bytes);
    const pageSize = pdf.getPages()[0]!.getSize();
    expect(pageSize.width).toBeCloseTo((279 * 72) / 25.4, 1);
    expect(pageSize.height).toBeCloseTo((216 * 72) / 25.4, 1);
  });

  it("uses the current preview design for both PDF variants", async () => {
    const paper = paperWith({
      designConfig: { paper: { size: "A4", orientation: "portrait", marginMm: 10 } },
    });
    const currentDesign = {
      paper: { size: "A5", orientation: "landscape", marginMm: 23 },
      font: { family: "serif", size: 14, questionSize: 19, optionSize: 16, headerSize: 18 },
      layout: { columnCount: 2, columnGapMm: 8, columnDivider: true, rowGapMm: 11, justify: true },
      numbering: { questionNumbering: "roman", showQuestionNumber: true, showMarksBesideQuestion: true },
    };

    const student = buildRenderedPaper(paper, "student", currentDesign);
    const teacher = buildRenderedPaper(paper, "teacher", currentDesign);
    expect(student.design).toEqual(teacher.design);
    expect(student.design.paper).toMatchObject({
      size: "A5",
      orientation: "landscape",
      marginMm: 23,
    });
    expect(student.sections[0]?.questions[0]?.answer).toBeNull();
    expect(teacher.sections[0]?.questions[0]?.answer).toContain("Newton");

    const result = await renderPaperPdf(student);
    const teacherResult = await renderPaperPdf(teacher);
    const [studentPdf, teacherPdf] = await Promise.all([
      PDFDocument.load(result.bytes),
      PDFDocument.load(teacherResult.bytes),
    ]);
    const pageSize = studentPdf.getPages()[0]!.getSize();
    const teacherPageSize = teacherPdf.getPages()[0]!.getSize();
    expect(pageSize.width).toBeCloseTo((210 * 72) / 25.4, 1);
    expect(pageSize.height).toBeCloseTo((148 * 72) / 25.4, 1);
    expect(teacherPageSize).toEqual(pageSize);
  });

  it("renders grouped CQ stimulus and labels while keeping answers teacher-only", () => {
    const paper = paperWith();
    paper.totalQuestions = 1;
    paper.totalMarks = 10;
    const entries = paper.sections[0]!.questions;
    const first = entries[0]!.question as unknown as Record<string, unknown>;
    const second = entries[1]!.question as unknown as Record<string, unknown>;
    first.creativeGroupId = second.creativeGroupId = "cq-group";
    first.creativePartOrder = 1;
    second.creativePartOrder = 2;
    first.creativePartLabel = "ক";
    second.creativePartLabel = "খ";
    first.creativeStimulus = "A ball rolls over a rough surface.";
    const makePart = (label: string, order: number, text: string, answer: string, marks: number) => ({
      order,
      marks,
      note: "",
      question: {
        question: { text },
        options: [],
        answer: { correctOptions: [], text: answer, booleanAnswer: null, matchingPairs: [] },
        explanation: "",
        type: "WRITTEN",
        difficulty: "MEDIUM",
        creativeGroupId: "cq-group",
        creativePartOrder: order,
        creativePartLabel: label,
      },
    });
    entries.push(makePart("গ", 2, "Explain the friction.", "Friction slows the ball.", 3) as unknown as (typeof entries)[number]);
    entries[2]!.order = 2;
    entries.push(makePart("ঘ", 3, "Analyze a smoother surface.", "It would travel farther.", 4) as unknown as (typeof entries)[number]);
    entries[3]!.order = 3;
    entries.forEach((entry, index) => {
      const source = entry.question as unknown as Record<string, unknown>;
      source.creativeGroupId = "cq-group";
      source.creativePartOrder = index + 1;
      source.creativePartLabel = ["ক", "খ", "গ", "ঘ"][index];
    });

    const student = buildRenderedPaper(paper, "student").sections[0]!.questions;
    expect(student[0]?.stimulus).toBe("A ball rolls over a rough surface.");
    expect(student).toHaveLength(1);
    expect(student[0]?.marks).toBe(10);
    expect(student[0]?.parts?.map((part) => part.label)).toEqual(["ক", "খ", "গ", "ঘ"]);
    expect(student[0]?.parts?.every((part) => part.answer === null)).toBe(true);
    expect(student.every((question) => question.answer === null)).toBe(true);

    const teacher = buildRenderedPaper(paper, "teacher").sections[0]!.questions;
    expect(teacher).toHaveLength(1);
    expect(teacher[0]?.parts?.[0]?.answer).toContain("Newton");
    expect(teacher[0]?.parts?.[1]?.answer).toContain("F = ma");
  });

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
