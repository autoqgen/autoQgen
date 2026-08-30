import { z } from "zod";

import {
  booleanQuerySchema,
  objectIdSchema,
  optionalObjectIdSchema,
  optionalTextSchema,
  paginationQuerySchema,
  searchTermSchema,
  tagsQuerySchema,
  yearSchema,
} from "@/lib/validation/common";
import {
  DIFFICULTIES,
  LANGUAGES,
  QUESTION_STATUSES,
  QUESTION_TYPES,
} from "@/types/question";

/**
 * Question schemas.
 *
 * Structural validation only — "is this well-formed JSON of the right shape".
 * Semantic rules that depend on the question type (an MCQ needs exactly one
 * correct option; a matching question needs pairs) live in
 * question.service.ts::validateAnswerForType, because they are business rules
 * and must apply identically to single create, update and bulk import.
 */

export const MAX_OPTIONS = 12;
export const MAX_TAGS = 20;
export const MAX_MATCHING_PAIRS = 20;
export const MAX_BULK_ITEMS = 500;

const optionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, "Option id is required.")
    .max(8)
    .transform((value) => value.toUpperCase()),
  text: z.string().trim().max(2000).default(""),
  image: z.string().trim().max(2048).default(""),
  explanation: z.string().trim().max(2000).default(""),
});

const questionContentSchema = z.object({
  text: z.string().trim().min(1, "Question text is required.").max(5000),
  image: optionalTextSchema(2048),
  audio: optionalTextSchema(2048),
  video: optionalTextSchema(2048),
  passage: optionalTextSchema(20000),
  latex: optionalTextSchema(5000),
});

const matchingPairSchema = z.object({
  left: z.string().trim().min(1).max(500),
  right: z.string().trim().min(1).max(500),
});

const answerSchema = z.object({
  text: z.string().trim().max(10000).default(""),
  correctOptions: z
    .array(z.string().trim().min(1).max(8))
    .max(MAX_OPTIONS)
    .default([])
    .transform((values) => values.map((value) => value.toUpperCase())),
  booleanAnswer: z.boolean().nullable().default(null),
  matchingPairs: z.array(matchingPairSchema).max(MAX_MATCHING_PAIRS).default([]),
});

/**
 * Note the fields that are NOT accepted from the client:
 *   createdBy, updatedBy, approvedBy, approvedAt, contentHash.
 * All are derived server-side. The previous project took `createdBy` from the
 * request body, which let anyone attribute content to any user.
 */
export const createQuestionSchema = z.object({
  /**
   * super_admin-only cross-tenant override. Everyone else gets their current
   * organization derived server-side; any value here is ignored for them.
   */
  organizationId: optionalObjectIdSchema,

  category: objectIdSchema,
  subject: objectIdSchema,
  chapter: objectIdSchema,
  topic: optionalObjectIdSchema,
  board: optionalObjectIdSchema,
  exam: optionalObjectIdSchema,

  type: z.enum(QUESTION_TYPES),
  difficulty: z.enum(DIFFICULTIES).nullable().optional().default(null),
  language: z.enum(LANGUAGES).optional().default("bn"),

  question: questionContentSchema,
  options: z.array(optionSchema).max(MAX_OPTIONS).optional().default([]),
  answer: answerSchema,
  explanation: optionalTextSchema(10000),

  source: optionalTextSchema(200),
  session: optionalTextSchema(80),
  year: yearSchema.nullable().optional().default(null),
  marks: z.coerce.number().min(0).max(1000).optional().default(1),
  estimatedTime: z.coerce.number().int().min(0).max(86400).optional().default(60),
  tags: z
    .array(z.string().trim().min(1).max(60))
    .max(MAX_TAGS)
    .optional()
    .default([])
    .transform((tags) => Array.from(new Set(tags.map((tag) => tag.toLowerCase())))),

  aiGenerated: z.boolean().optional().default(false),
  status: z.enum(QUESTION_STATUSES).optional().default("DRAFT"),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;

export const updateQuestionSchema = createQuestionSchema.partial().extend({
  isActive: z.boolean().optional(),
  reviewNote: optionalTextSchema(2000),
});

export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

/**
 * A single bulk-import row.
 *
 * Deliberately drops `organizationId`: a bulk import always targets the
 * caller's own current organization (for a super_admin, the organization they
 * have selected), resolved server-side in `questionService.bulkCreate`. An
 * `organizationId` key present in an uploaded CSV/JSON file is silently
 * stripped here and never reaches the service — a client can never steer an
 * import into another tenant.
 */
export const bulkImportQuestionSchema = createQuestionSchema.omit({ organizationId: true });

export type BulkImportQuestionInput = z.infer<typeof bulkImportQuestionSchema>;

export const bulkCreateQuestionSchema = z.object({
  questions: z
    .array(bulkImportQuestionSchema)
    .min(1, "Provide at least one question.")
    .max(MAX_BULK_ITEMS, `A bulk import may contain at most ${MAX_BULK_ITEMS} questions.`),
});

export type BulkCreateQuestionInput = z.infer<typeof bulkCreateQuestionSchema>;

export const MAX_BULK_REVIEW_ITEMS = 200;

export const bulkReviewQuestionSchema = z.object({
  ids: z
    .array(objectIdSchema)
    .min(1, "Select at least one question.")
    .max(MAX_BULK_REVIEW_ITEMS, `You may review at most ${MAX_BULK_REVIEW_ITEMS} questions at once.`),
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: optionalTextSchema(2000),
});

export type BulkReviewQuestionInput = z.infer<typeof bulkReviewQuestionSchema>;

/* --------------------------------- Query --------------------------------- */

export const questionListQuerySchema = paginationQuerySchema.extend({
  search: searchTermSchema,
  /** super_admin-only cross-tenant override; ignored for other roles. */
  organizationId: objectIdSchema.optional(),
  category: objectIdSchema.optional(),
  subject: objectIdSchema.optional(),
  chapter: objectIdSchema.optional(),
  topic: objectIdSchema.optional(),
  board: objectIdSchema.optional(),
  exam: objectIdSchema.optional(),
  type: z.enum(QUESTION_TYPES).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  language: z.enum(LANGUAGES).optional(),
  status: z.enum(QUESTION_STATUSES).optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  tags: tagsQuerySchema,
  aiGenerated: booleanQuerySchema,
  mine: booleanQuerySchema,
  /**
   * A request, not a grant. The service still checks the caller's permission —
   * this flag alone never unlocks answer keys.
   */
  withAnswers: booleanQuerySchema,
  sort: z.enum(["newest", "oldest", "relevance"]).catch("newest").default("newest"),
});

export type QuestionListQuery = z.infer<typeof questionListQuerySchema>;

export const questionDetailQuerySchema = z.object({
  withAnswers: booleanQuerySchema,
  /** super_admin-only cross-tenant override; ignored for other roles. */
  organizationId: objectIdSchema.optional(),
});

export type QuestionDetailQuery = z.infer<typeof questionDetailQuerySchema>;
