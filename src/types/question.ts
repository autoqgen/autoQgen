/**
 * Question domain enums.
 *
 * The polymorphic question/answer concept is carried over from the previous
 * project — it was the strongest part of that codebase. What changed is that
 * these values are now a single source of truth shared by the Mongoose schema,
 * the Zod validators and the service-layer answer validation, rather than being
 * duplicated as string literals in each route.
 */

export const QUESTION_TYPES = [
  "MCQ",
  "MULTIPLE_CORRECT",
  "TRUE_FALSE",
  "SHORT",
  "WRITTEN",
  "FILL_BLANK",
  "MATCHING",
  "ASSERTION_REASON",
  "IMAGE",
  "PASSAGE",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/**
 * The subset of question types the AI generator supports. Kept narrow on
 * purpose: these are the shapes Gemini produces reliably and that map cleanly
 * onto `validateAnswerForType`. The generated `type` must equal the requested
 * one — see src/lib/ai/question-normalise.ts.
 */
export const AI_QUESTION_TYPES = [
  "MCQ",
  "MULTIPLE_CORRECT",
  "TRUE_FALSE",
  "SHORT",
  "WRITTEN",
  "FILL_BLANK",
] as const;
export type AiQuestionType = (typeof AI_QUESTION_TYPES)[number];

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD", "EXPERT"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const QUESTION_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"] as const;
export type QuestionStatus = (typeof QUESTION_STATUSES)[number];

export const LANGUAGES = ["bn", "en"] as const;
export type Language = (typeof LANGUAGES)[number];

/**
 * Legal status transitions for author submission and reviewer approval.
 */
export const STATUS_TRANSITIONS: Record<QuestionStatus, readonly QuestionStatus[]> = {
  DRAFT: ["DRAFT", "PENDING", "APPROVED"],
  PENDING: ["PENDING", "APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["APPROVED", "PENDING"],
  REJECTED: ["REJECTED", "DRAFT", "PENDING"],
};

export function canTransition(from: QuestionStatus, to: QuestionStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Question types that require a non-empty option list. */
export const OPTION_BASED_TYPES: readonly QuestionType[] = [
  "MCQ",
  "MULTIPLE_CORRECT",
  "ASSERTION_REASON",
];

/** Question types answered with free text. */
export const TEXT_ANSWER_TYPES: readonly QuestionType[] = [
  "SHORT",
  "WRITTEN",
  "FILL_BLANK",
  "IMAGE",
  "PASSAGE",
];
