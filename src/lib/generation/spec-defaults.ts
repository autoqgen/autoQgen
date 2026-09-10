/**
 * Single source of truth for question-generation defaults + normalization.
 *
 * Pure, dependency-free (safe to import from client components and the server).
 * Every optional filter has an explicit, NON-RESTRICTIVE default. The same
 * `normalizeGenerationSpec()` runs on whatever the form builds before it is
 * sent, so the dry-run, the regenerate call and the generator all receive an
 * identical, safely-defaulted spec — a missing or legacy field can never turn
 * into a hidden restriction.
 */

export const DEFAULT_GENERATION_SETTINGS = {
  /** "balanced" | "EASY" | "MEDIUM" | "HARD" | "EXPERT" | "custom" */
  difficulty: "balanced",
  /** "any" | one of the question types | "custom" */
  questionType: "any",
  /** "automatic" | "equal" | "custom" */
  chapterDistribution: "automatic",
  previousQuestions: { mode: "allow" as "allow" | "exclude" | "prefer", percent: 100, paperRange: 5 },
  /** 0 = do not exclude questions used in recent papers. NEVER default to a positive value. */
  excludeRecentPapers: 0,
  mandatoryQuestionIds: [] as string[],
  excludedQuestionIds: [] as string[],
  topics: [] as string[],
  board: null as string | null,
  exam: null as string | null,
  year: null as number | null,
  language: null as string | null,
} as const;

type Quota<K extends string> = { [P in K]: string } & { count: number };

export interface GenerationSpecInput {
  organizationId?: string | null;
  category: string;
  subject: string;
  chapters?: string[] | null;
  topics?: string[] | null;
  board?: string | null;
  exam?: string | null;
  year?: number | null;
  language?: string | null;
  totalQuestions: number;
  totalMarks?: number | null;
  difficultyDistribution?: Quota<"difficulty">[] | null;
  typeDistribution?: Quota<"type">[] | null;
  chapterDistribution?: Quota<"chapter">[] | null;
  previousQuestions?: { mode?: string; percent?: number; paperRange?: number } | null;
  excludeRecentPapers?: number | null;
  mandatoryQuestionIds?: string[] | null;
  excludedQuestionIds?: string[] | null;
  randomize?: { selection?: boolean; order?: boolean; options?: boolean } | null;
  status?: "APPROVED";
}

export interface NormalizedGenerationSpec {
  organizationId: string | null;
  category: string;
  subject: string;
  chapters: string[];
  topics: string[];
  board: string | null;
  exam: string | null;
  year: number | null;
  language: string | null;
  totalQuestions: number;
  totalMarks: number | null;
  difficultyDistribution: Quota<"difficulty">[];
  typeDistribution: Quota<"type">[];
  chapterDistribution: Quota<"chapter">[];
  previousQuestions: { mode: "exclude" | "allow" | "prefer"; percent: number; paperRange: number };
  excludeRecentPapers: number;
  mandatoryQuestionIds: string[];
  excludedQuestionIds: string[];
  randomize: { selection: boolean; order: boolean; options: boolean };
  status: "APPROVED";
}

const asArray = <T,>(v: T[] | null | undefined): T[] => (Array.isArray(v) ? v : []);

const emptyToNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
};

const nonNegInt = (v: unknown, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
};

/**
 * Fills every optional field with its safe default and strips restrictions that
 * legacy specs may carry implicitly:
 *
 *  - `previousQuestions.percent` is forced to 100 unless the mode is "exclude"
 *    (a legacy cap must not silently limit the pool);
 *  - empty-string board/exam/language become `null` (= "any");
 *  - `excludeRecentPapers` falls back to 0 when missing/invalid;
 *  - zero-count distribution rows are dropped so an empty editor never becomes
 *    a hard 0-quota filter.
 *
 * Present, positive values are preserved — this only removes accidental
 * restrictions, it never overrides an explicit choice.
 */
export function normalizeGenerationSpec(input: GenerationSpecInput): NormalizedGenerationSpec {
  const pq = input.previousQuestions ?? {};
  const mode: "exclude" | "allow" | "prefer" =
    pq.mode === "exclude" || pq.mode === "prefer" || pq.mode === "allow"
      ? pq.mode
      : DEFAULT_GENERATION_SETTINGS.previousQuestions.mode;

  return {
    organizationId: input.organizationId ?? null,
    category: input.category,
    subject: input.subject,
    chapters: asArray(input.chapters),
    topics: asArray(input.topics),
    board: emptyToNull(input.board),
    exam: emptyToNull(input.exam),
    year: input.year ?? DEFAULT_GENERATION_SETTINGS.year,
    language: emptyToNull(input.language),
    totalQuestions: Math.max(1, nonNegInt(input.totalQuestions, 1)),
    totalMarks: input.totalMarks ?? null,
    difficultyDistribution: asArray(input.difficultyDistribution).filter((d) => d && d.count > 0),
    typeDistribution: asArray(input.typeDistribution).filter((t) => t && t.count > 0),
    chapterDistribution: asArray(input.chapterDistribution).filter((c) => c && c.count > 0),
    previousQuestions: {
      mode,
      percent: mode === "exclude" ? 0 : 100,
      paperRange: nonNegInt(pq.paperRange, DEFAULT_GENERATION_SETTINGS.previousQuestions.paperRange),
    },
    excludeRecentPapers: nonNegInt(
      input.excludeRecentPapers,
      DEFAULT_GENERATION_SETTINGS.excludeRecentPapers,
    ),
    mandatoryQuestionIds: asArray(input.mandatoryQuestionIds),
    excludedQuestionIds: asArray(input.excludedQuestionIds),
    randomize: {
      selection: input.randomize?.selection ?? true,
      order: input.randomize?.order ?? false,
      options: input.randomize?.options ?? false,
    },
    status: "APPROVED",
  };
}

/** Even split of `total` across `ids` (largest-remainder), for "Equal Distribution". */
export function evenChapterSplit(ids: string[], total: number): Quota<"chapter">[] {
  const n = ids.length;
  if (n === 0 || total <= 0) return [];
  const base = Math.floor(total / n);
  let remainder = total - base * n;
  return ids.map((chapter) => ({ chapter, count: base + (remainder-- > 0 ? 1 : 0) }));
}
