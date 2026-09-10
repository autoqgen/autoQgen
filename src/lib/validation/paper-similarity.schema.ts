import { z } from "zod";

import { objectIdSchema } from "@/lib/validation/common";

/**
 * Request bodies for the per-paper semantic similarity endpoints. The paper id
 * comes from the route param; these carry only the questions being acted on.
 */

export const keepBothSchema = z
  .object({
    questionAId: objectIdSchema,
    questionBId: objectIdSchema,
  })
  .refine((v) => v.questionAId !== v.questionBId, {
    path: ["questionBId"],
    message: "A pair must reference two different questions.",
  });

export type KeepBothInput = z.infer<typeof keepBothSchema>;

export const replaceQuestionSchema = z.object({
  /** The flagged question to remove and regenerate a replacement for. */
  questionId: objectIdSchema,
});

export type ReplaceQuestionInput = z.infer<typeof replaceQuestionSchema>;
