import { z } from "zod";

import {
  booleanQuerySchema,
  objectIdSchema,
  optionalObjectIdSchema,
  optionalTextSchema,
  paginationQuerySchema,
  searchTermSchema,
  shortTextSchema,
  yearSchema,
} from "@/lib/validation/common";
import { DIFFICULTIES, LANGUAGES, QUESTION_STATUSES, QUESTION_TYPES } from "@/types/question";
import { EXPORT_FORMATS, EXPORT_VARIANTS, PAPER_STATUSES } from "@/types/paper";

/**
 * Question paper schemas.
 *
 * Follows the Step 1 convention exactly: structural validation here, business
 * rules in the service. Server-derived fields (createdBy, totalMarks,
 * totalQuestions, version, status transitions) are deliberately absent from
 * every input schema so they cannot be supplied by a client.
 */

export const MAX_SECTIONS = 20;
export const MAX_QUESTIONS_PER_SECTION = 200;
export const MAX_QUESTIONS_PER_PAPER = 500;

const paperQuestionSchema = z.object({
  question: objectIdSchema,
  order: z.coerce.number().int().min(0).max(MAX_QUESTIONS_PER_SECTION),
  /** Optional override; the service falls back to the question's own marks. */
  marks: z.coerce.number().min(0).max(1000).optional(),
  note: optionalTextSchema(500),
});

const paperSectionSchema = z.object({
  title: optionalTextSchema(200),
  instructions: optionalTextSchema(2000),
  order: z.coerce.number().int().min(0).max(MAX_SECTIONS),
  questions: z.array(paperQuestionSchema).max(MAX_QUESTIONS_PER_SECTION),
});

export const createPaperSchema = z.object({
  title: shortTextSchema(200, "Title"),
  description: optionalTextSchema(2000),
  instructions: optionalTextSchema(5000),

  category: objectIdSchema,
  subject: objectIdSchema,
  board: optionalObjectIdSchema,
  exam: optionalObjectIdSchema,
  year: yearSchema.nullable().optional().default(null),

  durationMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional().default(null),

  sections: z.array(paperSectionSchema).max(MAX_SECTIONS).optional().default([]),
});

export type CreatePaperInput = z.infer<typeof createPaperSchema>;

export const updatePaperSchema = createPaperSchema.partial();
export type UpdatePaperInput = z.infer<typeof updatePaperSchema>;

/* ----------------------------- Auto generation ---------------------------- */

const difficultyQuotaSchema = z.object({
  difficulty: z.enum(DIFFICULTIES),
  count: z.coerce.number().int().min(0).max(MAX_QUESTIONS_PER_PAPER),
});

const typeQuotaSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  count: z.coerce.number().int().min(0).max(MAX_QUESTIONS_PER_PAPER),
});

/**
 * Auto-generation blueprint.
 *
 * `totalQuestions` is the authority. Distributions are quotas that must not sum
 * to more than it; the service fills any remainder with unconstrained picks.
 */
export const generatePaperSchema = z
  .object({
    category: objectIdSchema,
    subject: objectIdSchema,
    chapters: z.array(objectIdSchema).min(1, "Select at least one chapter.").max(50),
    topics: z.array(objectIdSchema).max(100).optional().default([]),
    board: optionalObjectIdSchema,
    exam: optionalObjectIdSchema,
    year: yearSchema.nullable().optional().default(null),
    language: z.enum(LANGUAGES).nullable().optional().default(null),

    totalQuestions: z.coerce
      .number()
      .int()
      .min(1, "A paper needs at least one question.")
      .max(MAX_QUESTIONS_PER_PAPER),
    totalMarks: z.coerce.number().min(0).max(10_000).nullable().optional().default(null),

    difficultyDistribution: z.array(difficultyQuotaSchema).max(4).optional().default([]),
    typeDistribution: z.array(typeQuotaSchema).max(10).optional().default([]),

    /** Only APPROVED questions are eligible; kept explicit for clarity. */
    status: z.enum(QUESTION_STATUSES).optional().default("APPROVED"),
  })
  .superRefine((value, ctx) => {
    const difficultySum = value.difficultyDistribution.reduce((sum, q) => sum + q.count, 0);
    if (difficultySum > value.totalQuestions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["difficultyDistribution"],
        message: `Difficulty quotas total ${difficultySum}, which exceeds totalQuestions (${value.totalQuestions}).`,
      });
    }

    const typeSum = value.typeDistribution.reduce((sum, q) => sum + q.count, 0);
    if (typeSum > value.totalQuestions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["typeDistribution"],
        message: `Type quotas total ${typeSum}, which exceeds totalQuestions (${value.totalQuestions}).`,
      });
    }

    const duplicateDifficulty =
      new Set(value.difficultyDistribution.map((q) => q.difficulty)).size !==
      value.difficultyDistribution.length;
    if (duplicateDifficulty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["difficultyDistribution"],
        message: "Each difficulty may appear at most once.",
      });
    }

    const duplicateType =
      new Set(value.typeDistribution.map((q) => q.type)).size !== value.typeDistribution.length;
    if (duplicateType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["typeDistribution"],
        message: "Each question type may appear at most once.",
      });
    }
  });

export type GeneratePaperInput = z.infer<typeof generatePaperSchema>;

/** Generation plus the metadata needed to persist the result immediately. */
export const generateAndSavePaperSchema = z.object({
  title: shortTextSchema(200, "Title"),
  description: optionalTextSchema(2000),
  instructions: optionalTextSchema(5000),
  durationMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional().default(null),
  spec: generatePaperSchema,
});

export type GenerateAndSavePaperInput = z.infer<typeof generateAndSavePaperSchema>;

/* -------------------------------- Lifecycle ------------------------------- */

export const paperActionSchema = z.object({
  action: z.enum(["publish", "archive", "restore", "clone"]),
  /** Optional new title when cloning. */
  title: z.string().trim().min(1).max(200).optional(),
});

export type PaperActionInput = z.infer<typeof paperActionSchema>;

/* --------------------------------- Query ---------------------------------- */

export const paperListQuerySchema = paginationQuerySchema.extend({
  search: searchTermSchema,
  status: z.enum(PAPER_STATUSES).optional(),
  category: objectIdSchema.optional(),
  subject: objectIdSchema.optional(),
  board: objectIdSchema.optional(),
  exam: objectIdSchema.optional(),
  mine: booleanQuerySchema,
  sort: z.enum(["newest", "oldest", "title"]).catch("newest").default("newest"),
});

export type PaperListQuery = z.infer<typeof paperListQuerySchema>;

export const paperExportQuerySchema = z.object({
  format: z.enum(EXPORT_FORMATS).catch("pdf").default("pdf"),
  variant: z.enum(EXPORT_VARIANTS).catch("student").default("student"),
});

export type PaperExportQuery = z.infer<typeof paperExportQuerySchema>;
