import { z } from "zod";

import { objectIdSchema, optionalObjectIdSchema, optionalTextSchema } from "@/lib/validation/common";
import { AI_QUESTION_TYPES, DIFFICULTIES } from "@/types/question";

/**
 * Schemas for the "AI Generated Questions" feature.
 *
 * Three server entry points, all POST:
 *   - `/api/questions/ai-generate` — ask Gemini for questions (no writes)
 *   - `/api/questions/ai-check`    — re-check duplicate status after an edit
 *   - `/api/questions/ai-import`   — persist the user's selected questions
 *
 * None of these accept an `organizationId`: placement is always the caller's
 * current organization, resolved server-side. Every taxonomy id is validated
 * against that organization before use.
 */

export const AI_MAX_QUESTIONS = 20;

/** "Any" is a UI convenience; the service maps it to the org default at write time. */
export const AI_LANGUAGES = ["any", "bn", "en"] as const;

const aiPlacementSchema = {
  category: objectIdSchema,
  subject: objectIdSchema,
  chapter: objectIdSchema,
  topic: optionalObjectIdSchema,
};

/* ------------------------------- Generate ------------------------------- */

export const aiGenerateQuestionsSchema = z.object({
  ...aiPlacementSchema,
  type: z.enum(AI_QUESTION_TYPES),
  // "Unset" in the UI.
  difficulty: z.enum(DIFFICULTIES).nullable().optional().default(null),
  language: z.enum(AI_LANGUAGES).optional().default("bn"),
  count: z.coerce.number().int().min(1).max(AI_MAX_QUESTIONS).optional().default(10),
  instruction: optionalTextSchema(500),
});

export type AiGenerateQuestionsInput = z.infer<typeof aiGenerateQuestionsSchema>;

/* -------------------------------- Check -------------------------------- */

export const aiCheckDuplicatesSchema = z.object({
  chapter: objectIdSchema,
  texts: z
    .array(z.string().trim().min(1).max(5000))
    .min(1, "Provide at least one question.")
    .max(AI_MAX_QUESTIONS),
});

export type AiCheckDuplicatesInput = z.infer<typeof aiCheckDuplicatesSchema>;

/* -------------------------------- Import ------------------------------- */

/**
 * One question the user chose to import. This is the *normalised* API shape
 * (options carry ids, the answer references those ids) — the same shape the
 * generate response hands the client, possibly edited in place before import.
 */
export const aiImportItemSchema = z.object({
  type: z.enum(AI_QUESTION_TYPES),
  difficulty: z.enum(DIFFICULTIES).nullable().optional().default(null),
  question: z.object({
    text: z.string().trim().min(1, "Question text is required.").max(5000),
  }),
  options: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(8).transform((value) => value.toUpperCase()),
        text: z.string().trim().max(2000).default(""),
      }),
    )
    .max(12)
    .optional()
    .default([]),
  answer: z.object({
    text: z.string().trim().max(10000).default(""),
    correctOptions: z
      .array(z.string().trim().min(1).max(8))
      .max(12)
      .default([])
      .transform((values) => values.map((value) => value.toUpperCase())),
    booleanAnswer: z.boolean().nullable().default(null),
  }),
  explanation: optionalTextSchema(10000),
  marks: z.coerce.number().min(0).max(1000).optional().default(1),
});

export type AiImportItemInput = z.infer<typeof aiImportItemSchema>;

export const aiImportQuestionsSchema = z.object({
  ...aiPlacementSchema,
  language: z.enum(AI_LANGUAGES).optional().default("bn"),
  questions: z
    .array(aiImportItemSchema)
    .min(1, "Select at least one question to import.")
    .max(AI_MAX_QUESTIONS, `You may import at most ${AI_MAX_QUESTIONS} questions at once.`),
});

export type AiImportQuestionsInput = z.infer<typeof aiImportQuestionsSchema>;
