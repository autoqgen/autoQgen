/**
 * Dependency-free CSV parsing and question mapping.
 *
 * Written by hand rather than pulling in a parser: the format is small, the
 * rules are well defined (RFC 4180), and the import path is security-sensitive
 * enough that an auditable 80 lines beats a transitive dependency tree.
 *
 * Handles quoted fields, escaped quotes (""), embedded commas and newlines, and
 * both CRLF and LF line endings.
 */

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  /** Rows whose column count did not match the header. */
  malformed: { line: number; message: string }[];
}

export function parseCsv(input: string): CsvParseResult {
  const text = input.replace(/^\uFEFF/, ""); // strip BOM
  const rows: string[][] = [];

  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inQuotes) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // Swallow; the \n branch closes the record.
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const nonEmpty = rows.filter((entry) => entry.some((cell) => cell.trim() !== ""));

  if (nonEmpty.length === 0) {
    return { headers: [], rows: [], malformed: [] };
  }

  const headers = (nonEmpty[0] ?? []).map((header) => header.trim());
  const malformed: { line: number; message: string }[] = [];
  const parsed: Record<string, string>[] = [];

  nonEmpty.slice(1).forEach((entry, offset) => {
    const line = offset + 2; // 1-based, and the header occupies line 1.

    if (entry.length !== headers.length) {
      malformed.push({
        line,
        message: `Expected ${headers.length} column(s) but found ${entry.length}.`,
      });
      return;
    }

    const record: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      record[header] = (entry[columnIndex] ?? "").trim();
    });
    parsed.push(record);
  });

  return { headers, rows: parsed, malformed };
}

/** Columns the importer understands. Anything else is ignored. */
export const CSV_COLUMNS = [
  "type",
  "text",
  "difficulty",
  "language",
  "marks",
  "chapter",
  "topic",
  "optionA",
  "optionB",
  "optionC",
  "optionD",
  "optionE",
  "correct",
  "answerText",
  "booleanAnswer",
  "matchingPairs",
  "explanation",
  "tags",
  "source",
  "year",
] as const;

export const CSV_TEMPLATE = [
  CSV_COLUMNS.join(","),
  [
    "MCQ",
    '"What is the SI unit of force?"',
    "EASY",
    "en",
    "1",
    "",
    "",
    "Newton",
    "Joule",
    "Watt",
    "Pascal",
    "",
    "A",
    "",
    "",
    "",
    '"Force is measured in newtons."',
    "physics;units",
    "NCTB",
    "2024",
  ].join(","),
  [
    "TRUE_FALSE",
    '"Sound travels faster in water than in air."',
    "MEDIUM",
    "en",
    "1",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "true",
    "",
    "",
    "physics",
    "",
    "",
  ].join(","),
].join("\n");

export interface MappedQuestion {
  row: number;
  payload: Record<string, unknown>;
  issues: string[];
}

/**
 * Converts a CSV row into the shape `createQuestionSchema` expects.
 *
 * Deliberately does NOT validate: the server is the authority, and duplicating
 * the rules here would create exactly the client/server divergence the Step 1
 * rebuild removed. Only shape mapping and obvious local problems are reported,
 * so the user gets fast feedback before uploading.
 */
export function mapRowToQuestion(
  row: Record<string, string>,
  index: number,
  defaults: { category: string; subject: string; chapter: string; board?: string; exam?: string },
): MappedQuestion {
  const issues: string[] = [];

  const type = (row.type ?? "").trim().toUpperCase();
  const text = (row.text ?? "").trim();

  if (!type) issues.push("Missing type.");
  if (!text) issues.push("Missing question text.");

  const options = (["optionA", "optionB", "optionC", "optionD", "optionE"] as const)
    .map((key, position) => ({
      id: String.fromCharCode(65 + position),
      text: (row[key] ?? "").trim(),
    }))
    .filter((option) => option.text.length > 0);

  const correctOptions = (row.correct ?? "")
    .split(/[;,|]/)
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const booleanRaw = (row.booleanAnswer ?? "").trim().toLowerCase();
  const booleanAnswer =
    booleanRaw === "true" ? true : booleanRaw === "false" ? false : null;

  const matchingPairs = (row.matchingPairs ?? "")
    .split(";")
    .map((pair) => pair.split("=>"))
    .filter((parts) => parts.length === 2)
    .map(([left, right]) => ({ left: (left ?? "").trim(), right: (right ?? "").trim() }))
    .filter((pair) => pair.left && pair.right);

  const marks = Number(row.marks);
  const year = Number(row.year);

  const payload: Record<string, unknown> = {
    category: defaults.category,
    subject: defaults.subject,
    chapter: (row.chapter ?? "").trim() || defaults.chapter,
    topic: (row.topic ?? "").trim() || null,
    board: defaults.board || null,
    exam: defaults.exam || null,
    type,
    difficulty: (row.difficulty ?? "").trim().toUpperCase() || null,
    language: (row.language ?? "").trim().toLowerCase() || "bn",
    question: { text },
    options,
    answer: {
      text: (row.answerText ?? "").trim(),
      correctOptions,
      booleanAnswer,
      matchingPairs,
    },
    explanation: (row.explanation ?? "").trim(),
    marks: Number.isFinite(marks) && marks > 0 ? marks : 1,
    year: Number.isFinite(year) && year > 1900 ? year : null,
    source: (row.source ?? "").trim(),
    tags: (row.tags ?? "")
      .split(/[;,|]/)
      .map((tag) => tag.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20),
    status: "DRAFT",
  };

  return { row: index, payload, issues };
}
