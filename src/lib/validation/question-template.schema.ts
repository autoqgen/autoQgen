import { z } from "zod";

import {
  objectIdSchema,
  optionalObjectIdSchema,
  optionalTextSchema,
  paginationQuerySchema,
  searchTermSchema,
  shortTextSchema,
  yearSchema,
} from "@/lib/validation/common";
import { LANGUAGES } from "@/types/question";
import { PAPER_TYPES } from "@/models/QuestionUsage";
import {
  MAX_QUESTIONS_PER_PAPER,
  chapterQuotaSchema,
  difficultyQuotaSchema,
  paperDesignSchema,
  previousQuestionsSchema,
  randomizeSchema,
  typeQuotaSchema,
} from "@/lib/validation/paper.schema";

/**
 * Question Pattern Template schemas.
 *
 * A template stores the SAME two config blobs the paper stack already uses — a
 * generation pattern (`generatePaperSchema`-shaped, but every taxonomy field is
 * optional so a template can be generic) and a Paper Design config
 * (`paperDesignSchema`, reused verbatim). The New Paper builder copies these
 * into its own local state; a template is never mutated by paper-specific edits.
 */

/**
 * Generation pattern held by a template. Mirrors `generatePaperSchema` field for
 * field, with taxonomy relaxed to optional and the same distribution sum checks.
 */
export const templateGenerationSpecSchema = z
  .object({
    category: optionalObjectIdSchema,
    subject: optionalObjectIdSchema,
    chapters: z.array(objectIdSchema).max(50).optional().default([]),
    topics: z.array(objectIdSchema).max(100).optional().default([]),
    board: optionalObjectIdSchema,
    exam: optionalObjectIdSchema,
    year: yearSchema.nullable().optional().default(null),
    language: z.enum(LANGUAGES).nullable().optional().default(null),

    totalQuestions: z.coerce
      .number()
      .int()
      .min(1, "A template needs at least one question.")
      .max(MAX_QUESTIONS_PER_PAPER)
      .optional()
      .default(10),
    totalMarks: z.coerce.number().min(0).max(10_000).nullable().optional().default(null),

    difficultyDistribution: z.array(difficultyQuotaSchema).max(4).optional().default([]),
    typeDistribution: z.array(typeQuotaSchema).max(10).optional().default([]),
    chapterDistribution: z.array(chapterQuotaSchema).max(50).optional().default([]),

    previousQuestions: previousQuestionsSchema,
    excludeRecentPapers: z.coerce.number().int().min(0).max(50).optional().default(0),

    mandatoryQuestionIds: z.array(objectIdSchema).max(MAX_QUESTIONS_PER_PAPER).optional().default([]),
    excludedQuestionIds: z.array(objectIdSchema).max(MAX_QUESTIONS_PER_PAPER).optional().default([]),

    randomize: randomizeSchema,

    /** Recorded on QuestionUsage when a paper is generated from this template. */
    paperType: z.enum(PAPER_TYPES).optional().default("OTHER"),

    /** Locked to a literal, exactly as `generatePaperSchema` does. */
    status: z.literal("APPROVED").optional().default("APPROVED"),
  })
  .superRefine((value, ctx) => {
    const mandatory = new Set(value.mandatoryQuestionIds);
    const overlap = value.excludedQuestionIds.filter((id) => mandatory.has(id));
    if (overlap.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["excludedQuestionIds"],
        message: "A question cannot be both mandatory and excluded.",
      });
    }
    const chapterSum = value.chapterDistribution.reduce((sum, q) => sum + q.count, 0);
    if (value.chapterDistribution.length > 0 && chapterSum > value.totalQuestions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["chapterDistribution"],
        message: `Chapter quotas total ${chapterSum}, which exceeds totalQuestions (${value.totalQuestions}).`,
      });
    }
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
    if (
      new Set(value.difficultyDistribution.map((q) => q.difficulty)).size !==
      value.difficultyDistribution.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["difficultyDistribution"],
        message: "Each difficulty may appear at most once.",
      });
    }
    if (
      new Set(value.typeDistribution.map((q) => q.type)).size !== value.typeDistribution.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["typeDistribution"],
        message: "Each question type may appear at most once.",
      });
    }
  });

export type TemplateGenerationSpecInput = z.infer<typeof templateGenerationSpecSchema>;

export const createQuestionTemplateSchema = z.object({
  /** super_admin-only cross-tenant override; ignored for other roles. */
  organizationId: optionalObjectIdSchema,
  name: shortTextSchema(200, "Name"),
  description: optionalTextSchema(2000),
  generationSpec: templateGenerationSpecSchema,
  designConfig: paperDesignSchema,
});

export type CreateQuestionTemplateInput = z.infer<typeof createQuestionTemplateSchema>;

export const updateQuestionTemplateSchema = z.object({
  name: shortTextSchema(200, "Name").optional(),
  description: optionalTextSchema(2000).optional(),
  generationSpec: templateGenerationSpecSchema.optional(),
  designConfig: paperDesignSchema.optional(),
});

export type UpdateQuestionTemplateInput = z.infer<typeof updateQuestionTemplateSchema>;

export const questionTemplateListQuerySchema = paginationQuerySchema.extend({
  search: searchTermSchema,
  subject: objectIdSchema.optional(),
  /** super_admin-only cross-tenant override; ignored for other roles. */
  organizationId: objectIdSchema.optional(),
});

export type QuestionTemplateListQuery = z.infer<typeof questionTemplateListQuerySchema>;
