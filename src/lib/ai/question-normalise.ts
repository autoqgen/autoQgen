import { validateAnswerForType } from "@/lib/services/question.service";
import { AI_QUESTION_TYPES, DIFFICULTIES, type AiQuestionType, type Difficulty } from "@/types/question";

/**
 * Turns Gemini's raw JSON into the normalised, API-shaped question the rest of
 * the app understands — and decides whether each item is structurally sound.
 *
 * Pure: no I/O, no database. Duplicate detection happens elsewhere (it needs
 * the organization-scoped question bank); this module only judges structure.
 *
 * An item with a non-empty `issues` array is "Needs Review" and must never be
 * auto-imported.
 */

const OPTION_LETTERS = "ABCDEFGHIJKL".split("");

const PLACEHOLDER_PATTERNS = [
  /^option\s+[a-l]$/i,
  /^(sample|example|placeholder|lorem ipsum)\b/i,
  /^practice question\s*\d*$/i,
  /^question\s*\d+$/i,
  /^answer\s*\d*$/i,
  /^n\/?a$/i,
];

export interface NormalisedQuestion {
  type: AiQuestionType;
  difficulty: Difficulty | null;
  question: { text: string };
  options: { id: string; text: string }[];
  answer: { text: string; correctOptions: string[]; booleanAnswer: boolean | null };
  explanation: string;
  marks: number;
}

export interface NormalisedCandidate {
  question: NormalisedQuestion;
  /** Empty ⇒ structurally valid. */
  issues: string[];
}

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function asStringArray(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return [];
  // Models are inconsistent: `answer` may come back as a bare string rather
  // than the requested array. Treat a scalar as a one-element list.
  const entries = Array.isArray(value) ? value : [value];
  return entries
    .map((entry) => {
      if (entry && typeof entry === "object" && "text" in entry) {
        return asString((entry as { text?: unknown }).text);
      }
      return asString(entry);
    })
    .map((text) => text.trim())
    .filter(Boolean);
}

const norm = (value: string): string => value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

function looksLikePlaceholder(text: string): boolean {
  const trimmed = text.trim();
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function coerceMarks(raw: unknown, type: AiQuestionType): number {
  const value = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(value) && value > 0 && value <= 1000) return value;
  return type === "WRITTEN" || type === "MULTIPLE_CORRECT" ? 3 : 1;
}

function coerceDifficulty(raw: unknown, forced: Difficulty | null): Difficulty | null {
  if (forced) return forced;
  const upper = asString(raw).toUpperCase().trim();
  return (DIFFICULTIES as readonly string[]).includes(upper) ? (upper as Difficulty) : null;
}

interface NormaliseOneParams {
  raw: unknown;
  requestedType: AiQuestionType;
  requestedDifficulty: Difficulty | null;
}

export function normaliseAiQuestion(params: NormaliseOneParams): NormalisedCandidate {
  const { raw, requestedType, requestedDifficulty } = params;
  const issues: string[] = [];
  const record = (raw ?? {}) as Record<string, unknown>;

  const text = asString(record.text).trim();
  if (!text) issues.push("The question text is empty.");
  if (text && looksLikePlaceholder(text)) issues.push("The question text looks like placeholder text.");

  // The generated type must match what was asked for.
  const rawType = asString(record.type).toUpperCase().trim();
  if (rawType && rawType !== requestedType) {
    issues.push(`The AI returned a ${rawType} question but ${requestedType} was requested.`);
  }

  const difficulty = coerceDifficulty(record.difficulty, requestedDifficulty);
  const explanation = asString(record.explanation).trim();
  const marks = coerceMarks(record.marks, requestedType);
  const answerStrings = asStringArray(record.answer);

  let options: { id: string; text: string }[] = [];
  const answer = { text: "", correctOptions: [] as string[], booleanAnswer: null as boolean | null };

  if (requestedType === "MCQ" || requestedType === "MULTIPLE_CORRECT") {
    const optionTexts = asStringArray(record.options);
    options = optionTexts.slice(0, OPTION_LETTERS.length).map((optionText, index) => ({
      id: OPTION_LETTERS[index]!,
      text: optionText,
    }));

    if (options.some((option) => looksLikePlaceholder(option.text))) {
      issues.push("One or more options look like placeholder text.");
    }
    const distinct = new Set(options.map((option) => norm(option.text)));
    if (distinct.size !== options.length) issues.push("The options are not all distinct.");

    // Map each answer string back to an option by text.
    const byText = new Map(options.map((option) => [norm(option.text), option.id]));
    for (const candidate of answerStrings) {
      const matchedId = byText.get(norm(candidate));
      if (matchedId) {
        if (!answer.correctOptions.includes(matchedId)) answer.correctOptions.push(matchedId);
      } else {
        issues.push(`The answer "${candidate}" does not match any option.`);
      }
    }
    if (answerStrings.length === 0) issues.push("No answer was provided.");
  } else if (requestedType === "TRUE_FALSE") {
    options = [];
    const first = norm(answerStrings[0] ?? "");
    if (first === "true" || first === "false") {
      answer.booleanAnswer = first === "true";
    } else {
      issues.push('The answer must be "True" or "False".');
    }
  } else {
    // SHORT / WRITTEN / FILL_BLANK — free-text answer, no options.
    options = [];
    answer.text = answerStrings.join(" / ").trim();
    if (!answer.text) issues.push("No answer text was provided.");
    if (requestedType === "FILL_BLANK" && text && !/_{2,}|\.{3,}|…/.test(text)) {
      issues.push('A fill-in-the-blank question should contain a blank ("_____").');
    }
  }

  // Re-run the authoritative business-rule check the create/import paths use.
  const answerIssues = validateAnswerForType(requestedType, options, {
    text: answer.text,
    correctOptions: answer.correctOptions,
    booleanAnswer: answer.booleanAnswer,
    matchingPairs: [],
  });
  for (const issue of answerIssues) issues.push(issue.message);

  return {
    question: {
      type: requestedType,
      difficulty,
      question: { text },
      options,
      answer,
      explanation,
      marks,
    },
    issues: Array.from(new Set(issues)),
  };
}

export interface NormaliseBatchParams {
  reply: unknown;
  requestedType: AiQuestionType;
  requestedDifficulty: Difficulty | null;
  /** Upper bound; extra items from the model are dropped. */
  limit: number;
}

/** Extracts and normalises the whole `{ questions: [...] }` reply. */
export function normaliseAiReply(params: NormaliseBatchParams): NormalisedCandidate[] {
  const { reply, requestedType, requestedDifficulty, limit } = params;

  const container = (reply ?? {}) as Record<string, unknown>;
  const list = Array.isArray(container.questions)
    ? container.questions
    : Array.isArray(reply)
      ? (reply as unknown[])
      : [];

  return list.slice(0, limit).map((raw) =>
    normaliseAiQuestion({ raw, requestedType, requestedDifficulty }),
  );
}

/** Guard used by the schema layer / tests. */
export function isAiQuestionType(value: unknown): value is AiQuestionType {
  return typeof value === "string" && (AI_QUESTION_TYPES as readonly string[]).includes(value);
}
