import { describe, expect, it } from "vitest";

import { mapRowToQuestion, parseCsv } from "@/lib/import/csv";

const DEFAULTS = {
  category: "507f1f77bcf86cd799439011",
  subject: "507f1f77bcf86cd799439012",
  chapter: "507f1f77bcf86cd799439013",
};

describe("parseCsv", () => {
  it("parses a simple file", () => {
    const result = parseCsv("type,text\nMCQ,What is force?\n");
    expect(result.headers).toEqual(["type", "text"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({ type: "MCQ", text: "What is force?" });
  });

  it("handles quoted fields containing commas and quotes", () => {
    const result = parseCsv('type,text\nMCQ,"Which, if any, is ""correct""?"\n');
    expect(result.rows[0]?.text).toBe('Which, if any, is "correct"?');
  });

  it("handles embedded newlines inside quotes", () => {
    const result = parseCsv('type,text\nWRITTEN,"line one\nline two"\n');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.text).toContain("line two");
  });

  it("handles CRLF line endings and a BOM", () => {
    const result = parseCsv("\uFEFFtype,text\r\nMCQ,Hello\r\n");
    expect(result.headers[0]).toBe("type");
    expect(result.rows).toHaveLength(1);
  });

  it("reports rows whose column count does not match the header", () => {
    const result = parseCsv("type,text\nMCQ\n");
    expect(result.rows).toHaveLength(0);
    expect(result.malformed).toHaveLength(1);
    expect(result.malformed[0]?.line).toBe(2);
  });

  it("returns empty structures for an empty file", () => {
    expect(parseCsv("").rows).toEqual([]);
    expect(parseCsv("\n\n").rows).toEqual([]);
  });
});

describe("mapRowToQuestion", () => {
  it("maps an MCQ row into the API payload shape", () => {
    const { payload, issues } = mapRowToQuestion(
      {
        type: "mcq",
        text: "What is the SI unit of force?",
        optionA: "Newton",
        optionB: "Joule",
        correct: "a",
        marks: "2",
        tags: "physics; units",
        difficulty: "easy",
      },
      0,
      DEFAULTS,
    );

    expect(issues).toEqual([]);
    expect(payload.type).toBe("MCQ");
    expect(payload.difficulty).toBe("EASY");
    expect(payload.marks).toBe(2);
    expect(payload.tags).toEqual(["physics", "units"]);
    expect((payload.answer as { correctOptions: string[] }).correctOptions).toEqual(["A"]);
    expect((payload.options as { id: string }[])).toHaveLength(2);
  });

  it("reports missing type and text rather than silently sending junk", () => {
    const { issues } = mapRowToQuestion({ type: "", text: "" }, 0, DEFAULTS);
    expect(issues.length).toBe(2);
  });

  it("parses a true/false row", () => {
    const { payload } = mapRowToQuestion(
      { type: "TRUE_FALSE", text: "Sound needs a medium.", booleanAnswer: "true" },
      0,
      DEFAULTS,
    );
    expect((payload.answer as { booleanAnswer: boolean | null }).booleanAnswer).toBe(true);
  });

  it("parses matching pairs", () => {
    const { payload } = mapRowToQuestion(
      { type: "MATCHING", text: "Match these.", matchingPairs: "Solid=>Fixed; Gas=>Free" },
      0,
      DEFAULTS,
    );
    expect((payload.answer as { matchingPairs: unknown[] }).matchingPairs).toHaveLength(2);
  });

  it("always assigns DRAFT status, never an imported one", () => {
    const { payload } = mapRowToQuestion(
      { type: "MCQ", text: "x", status: "APPROVED" },
      0,
      DEFAULTS,
    );
    // Import cannot smuggle content past review.
    expect(payload.status).toBe("DRAFT");
  });

  it("falls back to the destination chapter when the row omits one", () => {
    const { payload } = mapRowToQuestion({ type: "MCQ", text: "x" }, 0, DEFAULTS);
    expect(payload.chapter).toBe(DEFAULTS.chapter);
  });
});
