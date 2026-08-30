import { Types, type QueryFilter as FilterQuery } from "mongoose";

import { questionRepository } from "@/lib/repositories/question.repo";
import { ValidationError } from "@/lib/errors/app-error";
import { randomToken } from "@/lib/security/hash";
import { logger } from "@/lib/logger";
import type { IQuestion } from "@/models";
import type { Difficulty, QuestionType } from "@/types/question";
import type { GeneratePaperInput } from "@/lib/validation/paper.schema";

/**
 * Automatic paper generation.
 *
 * The problem is a constrained sampling one: pick N distinct approved questions
 * from the selected chapters while honouring a difficulty distribution and a
 * question-type distribution simultaneously.
 *
 * Approach
 * --------
 * 1. Expand the two marginal distributions into a joint slot plan. Type quotas
 *    are spread across difficulty quotas in proportion to the difficulty quotas
 *    themselves, so asking for "10 MCQ" and "6 EASY / 4 HARD" produces 6 easy
 *    MCQs and 4 hard MCQs rather than an arbitrary mix.
 * 2. Group the slots into buckets by their (type, difficulty) constraint and
 *    issue ONE `$sample` aggregation per bucket, excluding already-selected ids.
 *    Distinct buckets are bounded by 10 types × 4 difficulties, and in practice
 *    are a handful — so cost is a small constant, not O(N) queries.
 * 3. Backfill any bucket shortfall from progressively looser constraints, and
 *    report what could not be satisfied rather than silently returning a short
 *    paper.
 *
 * Duplicates are impossible by construction: every bucket query excludes the
 * running selection, and the result is de-duplicated again before returning.
 */

export interface GenerationSlot {
  type: QuestionType | null;
  difficulty: Difficulty | null;
  count: number;
}

export interface GenerationWarning {
  code:
    | "BUCKET_SHORTFALL"
    | "TOTAL_SHORTFALL"
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
}

export interface GenerationResult {
  questions: GeneratedQuestion[];
  requested: number;
  selected: number;
  totalMarks: number;
  warnings: GenerationWarning[];
  seed: string;
  /** The plan actually used, echoed back so the UI can explain the result. */
  slots: GenerationSlot[];
}

/**
 * Expands two marginal distributions into a joint slot plan.
 *
 * Exported for direct unit testing — the allocation arithmetic is the part most
 * likely to be subtly wrong, and it is pure.
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
      // Largest-remainder allocation so the counts always sum exactly.
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

      // Distribute the rounding remainder to the largest fractional parts.
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

  // Difficulty quotas not consumed by any type quota.
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

function baseFilter(spec: GeneratePaperInput, organizationId: string): FilterQuery<IQuestion> {
  const filter: FilterQuery<IQuestion> = {
    isActive: true,
    // The generator only ever draws from the paper's own organization's bank.
    organizationId: new Types.ObjectId(organizationId),
    // Only APPROVED content is ever eligible — PENDING / DRAFT / REJECTED are
    // excluded here regardless of anything the caller supplied. The schema
    // also pins `spec.status` to the "APPROVED" literal.
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

  return filter;
}

export const paperGeneratorService = {
  buildSlotPlan,

  async generate(spec: GeneratePaperInput, organizationId: string): Promise<GenerationResult> {
    const warnings: GenerationWarning[] = [];
    const base = baseFilter(spec, organizationId);

    // Feasibility check first: a clear error beats a mysteriously short paper.
    const poolSize = await questionRepository.countByFilter(base);

    if (poolSize === 0) {
      throw new ValidationError(
        "No approved questions match the selected chapters and filters.",
        [{ path: "chapters", message: "Widen the selection or approve more questions." }],
      );
    }

    if (poolSize < spec.totalQuestions) {
      warnings.push({
        code: "POOL_TOO_SMALL",
        message: `Only ${poolSize} approved question(s) match these filters; ${spec.totalQuestions} were requested.`,
      });
    }

    const slots = buildSlotPlan({
      totalQuestions: spec.totalQuestions,
      difficultyDistribution: spec.difficultyDistribution,
      typeDistribution: spec.typeDistribution,
    });

    const selected: GeneratedQuestion[] = [];
    const chosenIds = new Set<string>();

    const take = async (slot: GenerationSlot, need: number): Promise<number> => {
      if (need <= 0) return 0;

      const filter: FilterQuery<IQuestion> = { ...base };
      if (slot.type) filter.type = slot.type;
      if (slot.difficulty) filter.difficulty = slot.difficulty;
      if (chosenIds.size > 0) {
        filter._id = { $nin: Array.from(chosenIds).map((id) => new Types.ObjectId(id)) };
      }

      const sampled = await questionRepository.sample(filter, need);

      for (const doc of sampled) {
        const id = doc._id.toString();
        if (chosenIds.has(id)) continue;

        chosenIds.add(id);
        selected.push({
          id,
          type: doc.type,
          difficulty: doc.difficulty ?? null,
          marks: doc.marks ?? 1,
          chapter: doc.chapter?.toString() ?? "",
        });
      }

      return sampled.length;
    };

    // Pass 1 — honour every bucket exactly.
    for (const slot of slots) {
      const got = await take(slot, slot.count);

      if (got < slot.count) {
        const label = [slot.difficulty, slot.type].filter(Boolean).join(" ") || "unconstrained";
        warnings.push({
          code: "BUCKET_SHORTFALL",
          message: `Wanted ${slot.count} ${label} question(s) but only ${got} were available.`,
        });
      }
    }

    // Pass 2 — relax type, keep difficulty.
    const shortfallAfterPass1 = spec.totalQuestions - selected.length;
    if (shortfallAfterPass1 > 0 && spec.difficultyDistribution.length > 0) {
      for (const quota of spec.difficultyDistribution) {
        const need = spec.totalQuestions - selected.length;
        if (need <= 0) break;
        await take({ type: null, difficulty: quota.difficulty, count: need }, need);
      }
    }

    // Pass 3 — fully unconstrained backfill.
    const shortfallAfterPass2 = spec.totalQuestions - selected.length;
    if (shortfallAfterPass2 > 0) {
      await take({ type: null, difficulty: null, count: shortfallAfterPass2 }, shortfallAfterPass2);
    }

    if (selected.length < spec.totalQuestions) {
      warnings.push({
        code: "TOTAL_SHORTFALL",
        message: `Generated ${selected.length} of ${spec.totalQuestions} requested questions. Approve more questions or widen the chapter selection.`,
      });
    }

    const totalMarks = selected.reduce((sum, question) => sum + question.marks, 0);

    if (spec.totalMarks !== null && spec.totalMarks !== undefined && totalMarks !== spec.totalMarks) {
      warnings.push({
        code: "MARKS_MISMATCH",
        message: `Target was ${spec.totalMarks} marks; the selected questions total ${totalMarks}. Adjust the question count or edit marks on the paper.`,
      });
    }

    const seed = randomToken(8);

    logger.info("Paper generated", {
      requested: spec.totalQuestions,
      selected: selected.length,
      buckets: slots.length,
      warnings: warnings.length,
    });

    return {
      questions: selected,
      requested: spec.totalQuestions,
      selected: selected.length,
      totalMarks,
      warnings,
      seed,
      slots,
    };
  },

  /** Bucket availability, used by the builder UI to preview feasibility. */
  async availability(spec: GeneratePaperInput, organizationId: string) {
    return questionRepository.countByBucket(baseFilter(spec, organizationId));
  },
};

export type PaperGeneratorService = typeof paperGeneratorService;
