// ============================================================
// types.ts
// Shared types for the Question Paper Builder
// ============================================================

export type QuestionType =
  | "MCQ"
  | "MULTIPLE_CORRECT"
  | "TRUE_FALSE"
  | "WRITTEN"
  | "FILL_BLANK";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type Language = "bn" | "en";

export type PaperStatus = "DRAFT" | "PUBLISHED";

// ---------------- Dropdown / Reference Entities ----------------

export interface BaseEntity {
  _id: string;
  name: string;
}

export interface Category extends BaseEntity {}

export interface Subject extends BaseEntity {
  category?: string;
}

export interface Chapter extends BaseEntity {
  subject?: string;
  totalQuestions?: number;
}

export interface Topic extends BaseEntity {
  chapter?: string;
}

export interface Board extends BaseEntity {}

export interface Exam extends BaseEntity {}

// ---------------- Basic Information ----------------

export interface BasicInfoState {
  title: string;
  categoryId: string;
  subjectId: string;
  boardId: string;
  examId: string;
  classLevel: string;
  language: Language;
  session: string;
}

export const initialBasicInfo: BasicInfoState = {
  title: "",
  categoryId: "",
  subjectId: "",
  boardId: "",
  examId: "",
  classLevel: "",
  language: "bn",
  session: "",
};

// ---------------- Paper Settings ----------------

export interface PaperSettingsState {
  totalMarks: number;
  durationMinutes: number;
  negativeMarking: boolean;
  negativeMarkValue: number;
  instructions: string;
  shuffleQuestions: boolean;
  showAnswerKey: boolean;
}

export const initialPaperSettings: PaperSettingsState = {
  totalMarks: 100,
  durationMinutes: 60,
  negativeMarking: false,
  negativeMarkValue: 0.25,
  instructions: "",
  shuffleQuestions: true,
  showAnswerKey: false,
};

// ---------------- Question Bank ----------------

/**
 * Minimal shape of a question as returned by the question bank API.
 * Extend as needed to match your actual /api/questions response.
 */
export interface Question {
  _id: string;
  text: string;
  type: QuestionType;
  difficulty: Difficulty;
  chapter: string;
  marks?: number;
}

export type RowStatus = "idle" | "loading" | "ok" | "insufficient" | "error";

// ---------------- Question Distribution ----------------

export interface DistributionRow {
  id: string; // client-side row id (uuid)
  chapterId: string;
  difficulty: Difficulty;
  questionType: QuestionType;
  count: number;
  marksPerQuestion: number;
  // Auto-pulled from the question bank based on
  // chapterId + difficulty + questionType + count
  questionIds: string[];
  fetchedCount: number;
  status: RowStatus;
  errorMessage?: string;
}

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  MCQ: "MCQ (Single Correct)",
  MULTIPLE_CORRECT: "Multiple Correct",
  TRUE_FALSE: "True / False",
  WRITTEN: "Written",
  FILL_BLANK: "Fill in the Blank",
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  EASY: "Easy",
  MEDIUM: "Medium",
  HARD: "Hard",
};

// ---------------- Derived / Computed ----------------

export interface DistributionTotals {
  totalQuestions: number;
  totalMarks: number;
}

// ---------------- API Payload ----------------

export interface QuestionPaperPayload {
  title: string;
  category: string;
  subject: string;
  board?: string;
  exam?: string;
  classLevel?: string;
  language: Language;
  session?: string;
  settings: {
    totalMarks: number;
    durationMinutes: number;
    negativeMarking: boolean;
    negativeMarkValue: number;
    instructions: string;
    shuffleQuestions: boolean;
    showAnswerKey: boolean;
  };
  chapters: string[];
  distribution: {
    chapter: string;
    difficulty: Difficulty;
    type: QuestionType;
    count: number;
    marksPerQuestion: number;
    questionIds: string[];
  }[];
  // Flattened list of every auto-pulled question id, in order,
  // convenient for the backend to attach directly to the paper.
  questions: string[];
  status: PaperStatus;
}

export interface QuestionPaperResponse {
  _id: string;
  title: string;
  status: PaperStatus;
  createdAt?: string;
}

// ---------------- Validation ----------------

export type ValidationErrors = Record<string, string>;
