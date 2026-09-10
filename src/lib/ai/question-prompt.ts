import type { AiQuestionType, Difficulty } from "@/types/question";

/**
 * Builds the Gemini prompt for question generation.
 *
 * Pure and deterministic so it can be unit-tested and reviewed without a
 * network call. Taxonomy is passed by NAME only — the application owns the ids
 * and the AI never sees or invents them.
 */

export interface QuestionPromptContext {
  categoryName: string;
  subjectName: string;
  chapterName: string;
  topicName: string | null;
  type: AiQuestionType;
  difficulty: Difficulty | null;
  /** "any" | "bn" | "en" */
  language: "any" | "bn" | "en";
  count: number;
  instruction: string;
}

const TYPE_RULES: Record<AiQuestionType, string> = {
  MCQ: 'Exactly 4 entries in "options". "answer" is an array with exactly ONE string that is copied verbatim from "options".',
  MULTIPLE_CORRECT:
    'Exactly 4 entries in "options". "answer" is an array with TWO to THREE strings, each copied verbatim from "options".',
  TRUE_FALSE:
    '"options" must be exactly ["True", "False"]. "answer" is either ["True"] or ["False"].',
  SHORT:
    '"options" must be an empty array. "answer" is an array with one concise string answer (a few words to one sentence).',
  WRITTEN:
    '"options" must be an empty array. "answer" is an array with one string containing a model answer of 2-5 sentences.',
  FILL_BLANK:
    'The question text must contain a blank written as "_____". "options" must be an empty array. "answer" is an array with one string: the exact word or phrase that fills the blank.',
};

const LANGUAGE_RULES: Record<QuestionPromptContext["language"], string> = {
  any: "Write every question in whichever of Bangla or English best fits the subject; be consistent within each question.",
  bn: "Write every question, every option and every answer in Bangla (বাংলা). Do not use English except for standard technical symbols or units.",
  en: "Write every question, every option and every answer in English.",
};

const DIFFICULTY_RULES: Record<Difficulty, string> = {
  EASY: "Difficulty: EASY — direct recall or a single-step application.",
  MEDIUM: "Difficulty: MEDIUM — requires understanding and a short chain of reasoning.",
  HARD: "Difficulty: HARD — multi-step reasoning or a non-obvious application of the concept.",
  EXPERT: "Difficulty: EXPERT — deep synthesis across ideas in the chapter.",
};

export const QUESTION_SYSTEM_PROMPT = [
  "You are an exam-question author for a school and college question bank.",
  "You produce academically accurate, curriculum-appropriate questions.",
  "You return ONLY a single JSON object. No prose, no markdown, no code fences.",
].join(" ");

export function buildQuestionPrompt(context: QuestionPromptContext): string {
  const scope = [
    `Category: ${context.categoryName}`,
    `Subject: ${context.subjectName}`,
    `Chapter: ${context.chapterName}`,
    context.topicName ? `Topic: ${context.topicName}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const difficultyLine = context.difficulty
    ? DIFFICULTY_RULES[context.difficulty]
    : "Difficulty: mix EASY and MEDIUM sensibly.";

  const difficultyField = context.difficulty
    ? `"difficulty" must be "${context.difficulty}".`
    : '"difficulty" must be one of "EASY", "MEDIUM", "HARD", "EXPERT".';

  const instructionBlock = context.instruction.trim()
    ? `\nAdditional instruction from the user (follow it unless it conflicts with the rules above):\n${context.instruction.trim()}\n`
    : "";

  return [
    `Generate exactly ${context.count} ${context.type} questions.`,
    "",
    "Stay strictly within this scope — do not drift to other chapters or subjects:",
    scope,
    "",
    LANGUAGE_RULES[context.language],
    difficultyLine,
    "",
    "Output shape — a JSON object with a single key \"questions\", an array of objects:",
    "{",
    '  "text": string,            // the question stem',
    `  "type": "${context.type}",  // exactly this value for every item`,
    '  "options": string[],       // see type rule below',
    '  "answer": string[],        // see type rule below',
    '  "difficulty": string,      // see rule below',
    '  "marks": number,           // 1 for MCQ/TRUE_FALSE/FILL_BLANK/SHORT, 2-5 for WRITTEN/MULTIPLE_CORRECT',
    '  "explanation": string      // 1-2 sentences on why the answer is correct',
    "}",
    "",
    `Type rule for ${context.type}: ${TYPE_RULES[context.type]}`,
    difficultyField,
    "",
    "Hard requirements:",
    `- Produce exactly ${context.count} items, all of type ${context.type}.`,
    "- Every question must be a real, meaningful academic question with a definite correct answer.",
    "- Do NOT output placeholder text such as \"Option A\", \"Option B\", \"practice question 1\", \"Sample\", or lorem ipsum.",
    "- Options within one question must be distinct and plausible; wrong options must be believable distractors.",
    "- No duplicate or near-duplicate questions in the set.",
    "- Return valid JSON only. No markdown, no commentary, no trailing text.",
    instructionBlock,
  ].join("\n");
}
