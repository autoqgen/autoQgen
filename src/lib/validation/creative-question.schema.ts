import { z } from "zod";

import { booleanQuerySchema, objectIdSchema, optionalObjectIdSchema, optionalTextSchema, paginationQuerySchema } from "@/lib/validation/common";
import { DIFFICULTIES, QUESTION_STATUSES } from "@/types/question";

const partSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  answer: z.string().trim().min(1).max(10000),
  marks: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  order: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  sourceQuestion: optionalObjectIdSchema,
});

export const createCreativeQuestionSchema = z.object({
  organizationId: optionalObjectIdSchema,
  category: objectIdSchema,
  subject: objectIdSchema,
  chapter: objectIdSchema,
  topic: optionalObjectIdSchema,
  difficulty: z.enum(DIFFICULTIES).nullable().optional().default(null),
  instruction: optionalTextSchema(5000),
  stimulus: z.string().trim().min(1).max(20000),
  questions: z.array(partSchema).length(4),
  status: z.enum(QUESTION_STATUSES).optional().default("DRAFT"),
}).superRefine((value, ctx) => {
  const ordered = [...value.questions].sort((a, b) => a.order - b.order);
  const marks = [1, 2, 3, 4];
  ordered.forEach((part, index) => {
    if (part.order !== index || part.marks !== marks[index]) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["questions", index], message: "CQ parts must be ordered ক, খ, গ, ঘ with 1, 2, 3, 4 marks." });
    }
  });
});

export type CreateCreativeQuestionInput = z.infer<typeof createCreativeQuestionSchema>;

export const creativeQuestionListQuerySchema = paginationQuerySchema.extend({
  category: objectIdSchema.optional(),
  subject: objectIdSchema.optional(),
  chapter: objectIdSchema.optional(),
  topic: objectIdSchema.optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  status: z.enum(QUESTION_STATUSES).optional(),
  search: z.string().trim().max(200).optional(),
  mine: booleanQuerySchema,
  withAnswers: booleanQuerySchema,
});
export type CreativeQuestionListQuery = z.infer<typeof creativeQuestionListQuerySchema>;
