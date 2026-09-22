import { Types, type QueryFilter as FilterQuery } from "mongoose";

import { questionRepository } from "@/lib/repositories/question.repo";
import { questionUsageRepository } from "@/lib/repositories/question-usage.repo";
import { ValidationError } from "@/lib/errors/app-error";
import { randomToken } from "@/lib/security/hash";
import { logger } from "@/lib/logger";
import { DIFFICULTIES } from "@/types/question";
import type { IQuestion } from "@/models";
import type { Difficulty, QuestionType } from "@/types/question";
import type { GeneratePaperInput } from "@/lib/validation/paper.schema";

/**
 * Smart, best-match paper generation.
 *
 * Not a rigid AND filter: the difficulty / type / chapter distributions are
 * *soft goals*. The generator builds the eligible candidate pool for the
 * paper's own organization, ranks every candidate by how well it fills the
 * still-unmet part of each distribution (plus the previous-question
 * preference), and greedily takes the best ones until the requested total is
 * reached. When a bucket runs dry it borrows from the closest available
 * matches rather than returning a short paper.
 *
 * The ONLY hard failure is not having enough eligible questions in the
 * organization to reach the requested total.
 *
 * Organization isolation: `baseFilter` always pins `organizationId` (the value
 * is resolved server-side by the caller, never trusted from the client) and
 * every usage-history read is scoped to the same organization.
 */

export interface GenerationSlot {
  type: QuestionType | null;
  difficulty: Difficulty | null;
  count: number;
}

export interface GenerationWarning {
  code:
    | "BUCKET_SHORTFALL"
    | "DIFFICULTY_SHORTFALL"
    | "TYPE_SHORTFALL"
    | "CHAPTER_SHORTFALL"
    | "MARKS_MISMATCH"
    | "POOL_TOO_SMALL";
  message: string;
}

export interface GeneratedQuestion {
  id: string;
  type: QuestionType;
  difficulty: Difficulty | null;
  marks: number;
  chapter: string;
  previouslyUsed: boolean;
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  requested: number;
  selected: number;
  totalMarks: number;
  /** Approved, in-scope, not-excluded questions available before recency/previous filters. */
  eligibleCount: number;
  /** How many of the selected questions had been used on an earlier paper. */
  previousUsedCount: number;
  /** The cap the request placed on previously-used questions (equals `requested` when unrestricted). */
  previousAllowed: number;
  difficultyRequested: Record<string, number>;
  difficultyActual: Record<string, number>;
  typeRequested: Record<string, number>;
  typeActual: Record<string, number>;
  chapterActual: Record<string, number>;
  warnings: GenerationWarning[];
  seed: string;
  slots: GenerationSlot[];
  randomized: { selection: boolean; order: boolean; options: boolean };
}

/**
 * Expands two marginal distributions into a joint slot plan.
 *
 * Exported for direct unit testing — the allocation arithmetic is the part most
 * likely to be subtly wrong, and it is pure. Still used to echo a plan back to
 * the UI; the selector itself works from the marginal targets directly.
 */
export function buildSlotPlan(input: {
  totalQuestions: number;
  difficultyDistribution: { difficulty: Difficulty; count: number }[];
  typeDistribution: { type: QuestionType; count: number }[];
}): GenerationSlot[] {
  const slots: GenerationSlot[] = [];

  const remainingDifficulty = new Map<Difficulty, number>(
    input.difficultyDistribution.filter((q) => q.count > 0).map((q) => [q.difficulty, q.count]),
  );

  const typeQuotas = input.typeDistribution.filter((q) => q.count > 0);

  for (const typeQuota of typeQuotas) {
    let remainingForType = typeQuota.count;

    const difficultyPool = Math.max(
      0,
      Array.from(remainingDifficulty.values()).reduce((sum, value) => sum + value, 0),
    );

    if (difficultyPool > 0) {
      const entries = Array.from(remainingDifficulty.entries());
      const exact = entries.map(([difficulty, available]) => ({
        difficulty,
        available,
        raw: (typeQuota.count * available) / difficultyPool,
      }));

      const floored = exact.map((entry) => ({
        ...entry,
        take: Math.min(entry.available, Math.floor(entry.raw)),
      }));

      let allocated = floored.reduce((sum, entry) => sum + entry.take, 0);

      const byRemainder = [...floored].sort(
        (a, b) => b.raw - Math.floor(b.raw) - (a.raw - Math.floor(a.raw)),
      );

      for (const entry of byRemainder) {
        if (allocated >= typeQuota.count) break;
        if (entry.take >= entry.available) continue;
        entry.take += 1;
        allocated += 1;
      }

      for (const entry of floored) {
        if (entry.take <= 0) continue;
        slots.push({ type: typeQuota.type, difficulty: entry.difficulty, count: entry.take });
        remainingDifficulty.set(entry.difficulty, entry.available - entry.take);
        remainingForType -= entry.take;
      }
    }

    if (remainingForType > 0) {
      slots.push({ type: typeQuota.type, difficulty: null, count: remainingForType });
    }
  }

  for (const [difficulty, count] of remainingDifficulty) {
    if (count > 0) slots.push({ type: null, difficulty, count });
  }

  const planned = slots.reduce((sum, slot) => sum + slot.count, 0);
  const remainder = input.totalQuestions - planned;

  if (remainder > 0) {
    slots.push({ type: null, difficulty: null, count: remainder });
  }

  return slots.filter((slot) => slot.count > 0);
}

/* ========================================================================== */
/*  Candidate pool                                                             */
/* ========================================================================== */

function baseFilter(spec: GeneratePaperInput, organizationId: string): FilterQuery<IQuestion> {
  const filter: FilterQuery<IQuestion> = {
    isActive: true,
    // The generator only ever draws from the paper's own organization's bank.
    organizationId: new Types.ObjectId(organizationId),
    // Only APPROVED content is ever eligible — PENDING / DRAFT / REJECTED are
    // excluded here regardless of anything the caller supplied.
    status: "APPROVED",
    category: new Types.ObjectId(spec.category),
    subject: new Types.ObjectId(spec.subject),
    chapter: { $in: spec.chapters.map((id) => new Types.ObjectId(id)) },
  };

  if (spec.topics.length > 0) {
    filter.topic = { $in: spec.topics.map((id) => new Types.ObjectId(id)) };
  }
  if (spec.board) filter.board = new Types.ObjectId(spec.board);
  if (spec.exam) filter.exam = new Types.ObjectId(spec.exam);
  if (spec.year !== null && spec.year !== undefined) filter.year = spec.year;
  if (spec.language) filter.language = spec.language;

  const excluded = spec.excludedQuestionIds ?? [];
  if (excluded.length > 0) {
    filter._id = { $nin: excluded.map((id) => new Types.ObjectId(id)) };
  }

  return filter;
}

interface Candidate {
  id: string;
  type: QuestionType;
  difficulty: Difficulty | null;
  marks: number;
  chapter: string;
  previouslyUsed: boolean;
}

/** Largest-remainder split of `total` across `keys` weighted by `weights`. */
function evenTargets(keys: string[], total: number): Record<string, number> {
  const out: Record<string, number> = {};
  if (keys.length === 0 || total <= 0) return out;
  const base = Math.floor(total / keys.length);
  let remainder = total - base * keys.length;
  for (const key of keys) {
    out[key] = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
  }
  return out;
}

/** How wanted one more of a bucket is right now (higher = more wanted). */
function bucketScore(actual: number, target: number | undefined): number {
  if (!target || target <= 0) return 0.5; // no explicit preference
  if (actual < target) return 1; // still under quota
  return 0.05; // quota met — only pick to reach the overall total
}

export const paperGeneratorService = {
  buildSlotPlan,

  async generate(spec: GeneratePaperInput, organizationId: string): Promise<GenerationResult> {
    const total = spec.totalQuestions;
    const warnings: GenerationWarning[] = [];
    const randomize = spec.randomize ?? { selection: true, order: true, options: true };
    const previous = spec.previousQuestions ?? { mode: "allow", percent: 100, paperRange: 0 };

    const base = baseFilter(spec, organizationId);

    /* -- 1. Eligible pool (approved, in scope, not manually excluded) -------- */
    const poolDocs = await questionRepository.findPool(base);
    const eligibleCount = poolDocs.length;

    if (eligibleCount === 0) {
      throw new ValidationError("No approved questions match the selected chapters and filters.", [
        { path: "chapters", message: "Widen the selection or approve more questions." },
      ]);
    }

    /* -- 2. Mandatory questions (must be eligible & in this organization) ---- */
    const mandatoryIds = spec.mandatoryQuestionIds ?? [];
    const selected: Candidate[] = [];
    const chosen = new Set<string>();

    if (mandatoryIds.length > 0) {
      const docs = await questionRepository.findForPaper(mandatoryIds, organizationId);
      const byId = new Map(docs.map((doc) => [doc._id.toString(), doc]));
      const bad: string[] = [];

      for (const id of mandatoryIds) {
        const doc = byId.get(id);
        if (!doc || !doc.isActive || doc.status !== "APPROVED") {
          bad.push(id);
          continue;
        }
        if (chosen.has(id)) continue;
        chosen.add(id);
        selected.push({
          id,
          type: doc.type,
          difficulty: doc.difficulty ?? null,
          marks: doc.marks ?? 1,
          chapter: doc.chapter?.toString() ?? "",
          previouslyUsed: false, // filled in below
        });
      }

      if (bad.length > 0) {
        throw new ValidationError(
          "Some mandatory questions are not eligible for this organization or are not approved.",
          bad.map((id) => ({ path: "mandatoryQuestionIds", message: `Question ${id} cannot be used.` })),
        );
      }
    }

    /* -- 3. Working pool: drop mandatory, then recency, then previous rules -- */
    let pool: { _id: Types.ObjectId; type: QuestionType; difficulty: Difficulty | null; marks: number; chapter?: Types.ObjectId | null }[] =
      poolDocs.filter((doc) => !chosen.has(doc._id.toString()));

    const excludeRecent = spec.excludeRecentPapers ?? 0;
    if (excludeRecent > 0) {
      const recentPapers = await questionUsageRepository.recentPaperIds(organizationId, excludeRecent);
      const recentQuestionIds = await questionUsageRepository.questionIdsInPapers(
        organizationId,
        recentPapers,
      );
      pool = pool.filter((doc) => !recentQuestionIds.has(doc._id.toString()));
    }

    // Previously-used lookup, bounded to the requested paper range.
    const poolIds = pool.map((doc) => doc._id.toString());
    const usageStats = await questionUsageRepository.statsForQuestions(
      organizationId,
      [...poolIds, ...selected.map((c) => c.id)],
      previous.paperRange ?? 0,
    );

    for (const c of selected) c.previouslyUsed = usageStats.has(c.id);
    let previousSelected = selected.filter((c) => c.previouslyUsed).length;

    const unrestrictedPrevious = previous.mode === "allow" && previous.percent >= 100;
    const previousAllowed = unrestrictedPrevious
      ? total
      : Math.max(previousSelected, Math.round((total * previous.percent) / 100));
    const requiresPreviousPool = previous.mode !== "exclude" && previous.percent >= 100 && previousSelected > 0;

    if (previous.mode === "exclude") {
      pool = pool.filter((doc) => !usageStats.has(doc._id.toString()));
    } else if (requiresPreviousPool) {
      pool = pool.filter((doc) => usageStats.has(doc._id.toString()));
    }

    /* -- 4. Hard feasibility check (the only failure mode) ------------------ */
    const stillNeed = total - selected.length;
    if (pool.length < stillNeed) {
      if (requiresPreviousPool) {
        throw new ValidationError(
          `Only ${pool.length + previousSelected} previously used question(s) are available, but ${total} were requested with Previous Questions at 100%.`,
          [{ path: "totalQuestions", message: "Not enough previous questions are available." }],
        );
      }
      throw new ValidationError(
        `Only ${pool.length + selected.length} eligible question(s) are available after your filters, ` +
          `but ${total} were requested. Approve more questions, widen the chapter selection, or relax the ` +
          `previous-question / recent-paper restrictions.`,
        [{ path: "totalQuestions", message: "Not enough eligible questions in this organization." }],
      );
    }
    if (eligibleCount < total) {
      warnings.push({
        code: "POOL_TOO_SMALL",
        message: `${eligibleCount} approved question(s) match these filters; ${total} were requested — the closest available matches were used.`,
      });
    }

    /* -- 5. Distribution targets (soft goals) ------------------------------- */
    const diffTarget: Record<string, number> = {};
    for (const q of spec.difficultyDistribution ?? []) diffTarget[q.difficulty] = q.count;
    const typeTarget: Record<string, number> = {};
    for (const q of spec.typeDistribution ?? []) typeTarget[q.type] = q.count;

    let chapterTarget: Record<string, number>;
    if ((spec.chapterDistribution ?? []).length > 0) {
      chapterTarget = {};
      for (const q of spec.chapterDistribution!) chapterTarget[q.chapter] = q.count;
    } else {
      chapterTarget = evenTargets(spec.chapters, total);
    }

    // Discount what the mandatory picks already contribute.
    const diffActual: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0, EXPERT: 0 };
    const typeActual: Record<string, number> = {};
    const chapterActual: Record<string, number> = {};
    for (const c of selected) {
      if (c.difficulty) diffActual[c.difficulty] = (diffActual[c.difficulty] ?? 0) + 1;
      typeActual[c.type] = (typeActual[c.type] ?? 0) + 1;
      if (c.chapter) chapterActual[c.chapter] = (chapterActual[c.chapter] ?? 0) + 1;
    }

    /* -- 6. Greedy best-match fill ---------------------------------------- */
    const jitter = () => (randomize.selection ? Math.random() * 0.5 : 0);

    while (selected.length < total && pool.length > 0) {
      let bestIndex = 0;
      let bestScore = -Infinity;

      for (let i = 0; i < pool.length; i += 1) {
        const doc = pool[i]!;
        const chapterId = doc.chapter?.toString() ?? "";
        const used = usageStats.has(doc._id.toString());

        let score =
          3 * bucketScore(doc.difficulty ? diffActual[doc.difficulty] ?? 0 : 0, doc.difficulty ? diffTarget[doc.difficulty] : undefined) +
          2 * bucketScore(typeActual[doc.type] ?? 0, typeTarget[doc.type]) +
          2 * bucketScore(chapterActual[chapterId] ?? 0, chapterTarget[chapterId]);

        if (used) {
          if (previousSelected >= previousAllowed) {
            score -= 100; // cap reached — only if nothing else is left
          } else if (previous.mode === "prefer") {
            score += 1.5;
          }
        }

        score += jitter();

        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }

      const pick = pool.splice(bestIndex, 1)[0]!;
      const chapterId = pick.chapter?.toString() ?? "";
      const used = usageStats.has(pick._id.toString());

      chosen.add(pick._id.toString());
      selected.push({
        id: pick._id.toString(),
        type: pick.type,
        difficulty: pick.difficulty ?? null,
        marks: pick.marks ?? 1,
        chapter: chapterId,
        previouslyUsed: used,
      });

      if (pick.difficulty) diffActual[pick.difficulty] = (diffActual[pick.difficulty] ?? 0) + 1;
      typeActual[pick.type] = (typeActual[pick.type] ?? 0) + 1;
      if (chapterId) chapterActual[chapterId] = (chapterActual[chapterId] ?? 0) + 1;
      if (used) previousSelected += 1;
    }

    /* -- 7. Order & assemble result ------------------------------------- */
    let ordered = selected;
    if (randomize.order) {
      ordered = [...selected];
      for (let i = ordered.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [ordered[i], ordered[j]] = [ordered[j]!, ordered[i]!];
      }
    }

    const totalMarks = ordered.reduce((sum, q) => sum + q.marks, 0);
    const previousUsedCount = ordered.filter((q) => q.previouslyUsed).length;

    const difficultyRequested: Record<string, number> = {};
    for (const d of DIFFICULTIES) if (diffTarget[d]) difficultyRequested[d] = diffTarget[d]!;
    for (const [d, target] of Object.entries(diffTarget)) {
      if ((diffActual[d] ?? 0) < target) {
        warnings.push({
          code: "DIFFICULTY_SHORTFALL",
          message: `${d}: asked for ${target}, best available was ${diffActual[d] ?? 0}.`,
        });
      }
    }
    for (const [t, target] of Object.entries(typeTarget)) {
      if ((typeActual[t] ?? 0) < target) {
        warnings.push({
          code: "TYPE_SHORTFALL",
          message: `${t.replace(/_/g, " ")}: asked for ${target}, best available was ${typeActual[t] ?? 0}.`,
        });
      }
    }
    if ((spec.chapterDistribution ?? []).length > 0) {
      for (const [ch, target] of Object.entries(chapterTarget)) {
        if ((chapterActual[ch] ?? 0) < target) {
          warnings.push({
            code: "CHAPTER_SHORTFALL",
            message: `A chapter quota of ${target} could not be met (got ${chapterActual[ch] ?? 0}).`,
          });
        }
      }
    }

    if (spec.totalMarks !== null && spec.totalMarks !== undefined && totalMarks !== spec.totalMarks) {
      warnings.push({
        code: "MARKS_MISMATCH",
        message: `Target was ${spec.totalMarks} marks; the selected questions total ${totalMarks}.`,
      });
    }

    const seed = randomToken(8);

    logger.info("Paper generated", {
      requested: total,
      selected: ordered.length,
      eligible: eligibleCount,
      previousUsed: previousUsedCount,
      warnings: warnings.length,
    });

    return {
      questions: ordered.map(({ id, type, difficulty, marks, chapter, previouslyUsed }) => ({
        id,
        type,
        difficulty,
        marks,
        chapter,
        previouslyUsed,
      })),
      requested: total,
      selected: ordered.length,
      totalMarks,
      eligibleCount,
      previousUsedCount,
      previousAllowed: unrestrictedPrevious ? total : previousAllowed,
      difficultyRequested,
      difficultyActual: diffActual,
      typeRequested: { ...typeTarget },
      typeActual,
      chapterActual,
      warnings,
      seed,
      slots: buildSlotPlan({
        totalQuestions: total,
        difficultyDistribution: spec.difficultyDistribution ?? [],
        typeDistribution: spec.typeDistribution ?? [],
      }),
      randomized: {
        selection: randomize.selection,
        order: randomize.order,
        options: randomize.options,
      },
    };
  },

  /**
   * Feasibility preview for the builder UI: the eligible count plus a per-bucket
   * breakdown, all organization-scoped.
   */
  async availability(spec: GeneratePaperInput, organizationId: string) {
    const base = baseFilter(spec, organizationId);
    const [eligibleCount, byBucket] = await Promise.all([
      questionRepository.countByFilter(base),
      questionRepository.countByBucket(base),
    ]);
    return { eligibleCount, byBucket };
  },
};

export type PaperGeneratorService = typeof paperGeneratorService;
