/**
 * Strict shape of the JSON object Groq is ALLOWED to return.
 * Groq NEVER returns anything else — no prose, no markdown, no explanations.
 * The backend (searchQuestions.ts) is solely responsible for turning this
 * into a MongoDB query. Groq never touches Mongo.
 */
export interface ExtractedFilters {
  category?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  board?: string | null;
  exam?: string | null;

  type?: string | null; // Question type e.g. MCQ, WRITTEN, TRUE_FALSE...
  difficulty?: string | null; // Easy | Medium | Hard
  language?: string | null; // bn | en
  status?: string | null; // DRAFT | PENDING | APPROVED | REJECTED
  aiGenerated?: boolean | null;

  year?: number | null;
  session?: string | null;
  source?: string | null;
  tags?: string[] | null;

  limit?: number | null;
}

export interface SearchQuestionsResult {
  success: boolean;
  count: number;
  questions: unknown[];
  appliedFilters: Record<string, unknown>;
  unresolvedFilters: string[];
}

export interface ExtractFiltersResult {
  success: boolean;
  filters: ExtractedFilters | null;
  rawModelOutput?: string;
  error?: string;
}

export const ALLOWED_FILTER_KEYS: (keyof ExtractedFilters)[] = [
  "category",
  "subject",
  "chapter",
  "topic",
  "board",
  "exam",
  "type",
  "difficulty",
  "language",
  "status",
  "aiGenerated",
  "year",
  "session",
  "source",
  "tags",
  "limit",
];

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;
