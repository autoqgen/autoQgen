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
import { DIFFICULTIES, LANGUAGES, QUESTION_TYPES } from "@/types/question";
import { EXPORT_FORMATS, EXPORT_VARIANTS, PAPER_STATUSES } from "@/types/paper";
import { PAPER_TYPES } from "@/models/QuestionUsage";

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
  /** super_admin-only cross-tenant override; ignored for other roles. */
  organizationId: optionalObjectIdSchema,

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

export const difficultyQuotaSchema = z.object({
  difficulty: z.enum(DIFFICULTIES),
  count: z.coerce.number().int().min(0).max(MAX_QUESTIONS_PER_PAPER),
});

export const typeQuotaSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  count: z.coerce.number().int().min(0).max(MAX_QUESTIONS_PER_PAPER),
});

export const chapterQuotaSchema = z.object({
  chapter: objectIdSchema,
  count: z.coerce.number().int().min(0).max(MAX_QUESTIONS_PER_PAPER),
});

export const PREVIOUS_QUESTION_MODES = ["exclude", "allow", "prefer"] as const;

/**
 * How previously-used questions (see QuestionUsage) participate in generation.
 *
 *  - `exclude` (default): never pick a question that has been used before.
 *  - `allow`: up to `percent`% of the paper may be previously-used questions.
 *  - `prefer`: like `allow`, but previously-used questions are scored higher.
 *
 * `paperRange` bounds "previously used" to the organization's last N papers
 * (0 = all history). All of this is organization-scoped in the service.
 */
export const previousQuestionsSchema = z
  .object({
    mode: z.enum(PREVIOUS_QUESTION_MODES).optional().default("allow"),
    percent: z.coerce.number().min(0).max(100).optional().default(100),
    paperRange: z.coerce.number().int().min(0).max(100).nullable().optional().default(null),
  })
  .optional()
  // Default = no previous-question restriction, so a caller that omits the
  // field (e.g. the existing regenerate panel) keeps today's behaviour.
  .default({});

/** Shared with the pattern-template schema so both accept the identical shape. */
export const randomizeSchema = z
  .object({
    selection: z.boolean().optional().default(true),
    // `order` / `options` default off so a caller that omits `randomize`
    // (e.g. the existing regenerate panel) keeps today's behaviour; the
    // smart-generation form sends all three explicitly.
    order: z.boolean().optional().default(false),
    options: z.boolean().optional().default(false),
  })
  .optional()
  .default({});

/**
 * Auto-generation blueprint.
 *
 * `totalQuestions` is the authority. Distributions are quotas that must not sum
 * to more than it; the service fills any remainder with unconstrained picks.
 */
export const generatePaperSchema = z
  .object({
    /** super_admin-only cross-tenant override; ignored for other roles. */
    organizationId: optionalObjectIdSchema,
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

    /**
     * Optional custom per-chapter quota. Empty = automatic (spread evenly
     * across the selected chapters by the best-match selector).
     */
    chapterDistribution: z.array(chapterQuotaSchema).max(50).optional().default([]),

    previousQuestions: previousQuestionsSchema,

    /**
     * Questions used in the organization's most recent N papers are never
     * eligible (0 = no recency restriction). Applied on top of, and stricter
     * than, `previousQuestions`.
     */
    excludeRecentPapers: z.coerce.number().int().min(0).max(50).nullable().optional().default(null),

    /** Always included (subject to being eligible). Order preserved. */
    mandatoryQuestionIds: z.array(objectIdSchema).max(MAX_QUESTIONS_PER_PAPER).optional().default([]),
    /** Never selected. */
    excludedQuestionIds: z.array(objectIdSchema).max(MAX_QUESTIONS_PER_PAPER).optional().default([]),

    randomize: randomizeSchema,

    /**
     * Generation only ever draws from APPROVED questions — PENDING / DRAFT /
     * REJECTED are never paper-eligible. Locked to a literal so a crafted
     * request cannot widen the pool; the generator also hard-codes this (see
     * paper-generator.service.ts::baseFilter).
     */
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
    if (value.mandatoryQuestionIds.length > value.totalQuestions) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["mandatoryQuestionIds"],
        message: `You marked ${value.mandatoryQuestionIds.length} question(s) mandatory, more than the ${value.totalQuestions} requested.`,
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

/* --------------------------- Design (appearance) ------------------------- */

/**
 * Question-paper appearance / output configuration, edited from the Design
 * sidebar. Structured but renderer-forward: "Save Design" persists it on the
 * paper without regenerating questions. The export renderer consumes the
 * subset it currently supports and ignores the rest — no field here changes
 * question selection or usage.
 */
const bool = (d: boolean) => z.boolean().optional().default(d);
const str = (d = "") => z.string().trim().max(400).optional().default(d);

export const paperDesignSchema = z.object({
  template: str("none"),
  output: z
    .object({
      question: bool(true),
      sheet: bool(true),
      downloadFile: bool(true),
      answer: bool(false),
      solution: bool(false),
      explanation: bool(false),
    })
    .optional()
    .default({}),
  header: z
    .object({
      showLogo: bool(true),
      logoPosition: z.enum(["left", "center", "right"]).optional().default("center"),
      headerStyle: z.enum(["standard", "compact", "formal"]).optional().default("standard"),
      showOrganizationName: bool(true),
      organizationName: str(),
      showOrganizationAddress: bool(true),
      organizationAddress: str(),
      programName: str(),
      subject: str(),
      className: str(),
      chapter: str(),
      board: str(),
      year: str(),
      /** Legacy combined field; kept so older saved configs still parse. */
      boardAndYear: str(),
      totalMarks: str(),
      totalTime: str(),
      instructions: z.string().trim().max(5000).optional().default(""),
    })
    .optional()
    .default({}),
  studentInfo: z
    .object({
      name: bool(true),
      roll: bool(true),
      registration: bool(false),
      section: bool(false),
      obtainedMarks: bool(true),
      date: bool(true),
      dateMode: z.enum(["blank", "today", "custom"]).optional().default("blank"),
      customDate: str(),
    })
    .optional()
    .default({}),
  codes: z
    .object({ showSubjectCode: bool(true), showQuestionSetCode: bool(true) })
    .optional()
    .default({}),
  heading: z
    .object({
      language: z.enum(["bn", "en"]).optional().default("en"),
      style: str("default"),
    })
    .optional()
    .default({}),
  layout: z
    .object({
      arrangeBySubject: bool(true),
      fillAvailableSpace: bool(true),
      justify: bool(true),
      columnCount: z.coerce.number().int().min(1).max(4).optional().default(2),
      columnDivider: bool(true),
      columnGapMm: z.coerce.number().min(0).max(50).optional().default(13),
      rowGapMm: z.coerce.number().min(0).max(50).optional().default(0),
    })
    .optional()
    .default({}),
  numbering: z
    .object({
      showQuestionNumber: bool(true),
      questionNumbering: z.enum(["bn-digit", "en-digit", "bn-letter", "en-letter", "roman", "arabic-letter"]).optional().default("en-digit"),
      optionStyle: z.enum(["paren-both", "dot", "paren-right", "spaced-paren"]).optional().default("paren-both"),
      mcqOptionLabels: z.enum(["bn-letter", "en-lower", "en-upper", "roman", "bn-digit"]).optional().default("en-upper"),
      showMarksBesideQuestion: bool(true),
    })
    .optional()
    .default({}),
  font: z
    .object({
      family: z.enum(["system", "sans", "serif", "mono"]).optional().default("system"),
      size: z.coerce.number().min(6).max(48).optional().default(14),
      questionSize: z.coerce.number().min(6).max(48).optional().default(14),
      optionSize: z.coerce.number().min(6).max(48).optional().default(13),
      headerSize: z.coerce.number().min(6).max(48).optional().default(16),
    })
    .optional()
    .default({}),
  paper: z
    .object({
      size: z.enum(["A4", "Letter", "Legal", "A5"]).optional().default("A4"),
      orientation: z.enum(["portrait", "landscape"]).optional().default("portrait"),
      twoCopiesPerPage: bool(false),
      marginMm: z.coerce.number().min(0).max(50).optional().default(10),
    })
    .optional()
    .default({}),
  booklet: z.object({ enabled: bool(false) }).optional().default({}),
  advanced: z
    .object({
      watermark: bool(false),
      watermarkText: str(),
      watermarkOpacity: z.coerce.number().min(2).max(40).optional().default(8),
      watermarkPosition: z.enum(["diagonal", "horizontal"]).optional().default("diagonal"),
      headerBand: bool(false),
      headerBandText: str(),
      footerBand: bool(false),
      footerBandText: str(),
    })
    .optional()
    .default({}),
});

export type PaperDesignInput = z.infer<typeof paperDesignSchema>;

/** The stored default — applied to every generated paper and merged on read. */
export const DEFAULT_PAPER_DESIGN: PaperDesignInput = paperDesignSchema.parse({});

/* ------------------------- Generate-and-save ---------------------------- */

/** Generation plus the metadata needed to persist the result immediately. */
export const generateAndSavePaperSchema = z.object({
  title: shortTextSchema(200, "Title"),
  description: optionalTextSchema(2000),
  instructions: optionalTextSchema(5000),
  durationMinutes: z.coerce.number().int().min(0).max(1440).nullable().optional().default(null),
  /** Recorded on QuestionUsage so history can say "used in a Model Test / Exam / …". */
  paperType: z.enum(PAPER_TYPES).optional().default("OTHER"),
  spec: generatePaperSchema,
  /**
   * Optional appearance config to persist on the new paper (e.g. loaded from a
   * Question Pattern Template). Omitted ⇒ the stored `DEFAULT_PAPER_DESIGN`.
   */
  designConfig: paperDesignSchema.optional(),
});

export type GenerateAndSavePaperInput = z.infer<typeof generateAndSavePaperSchema>;

/* -------------------------------- Lifecycle ------------------------------- */

export const paperActionSchema = z.object({
  action: z.enum(["publish", "archive", "restore", "clone", "previous-usage-confirm"]),
  decision: z.enum(["confirmed", "declined"]).optional(),
  /** Optional new title when cloning. */
  title: z.string().trim().min(1).max(200).optional(),
});

export type PaperActionInput = z.infer<typeof paperActionSchema>;

/* --------------------------------- Query ---------------------------------- */

export const paperListQuerySchema = paginationQuerySchema.extend({
  search: searchTermSchema,
  /** super_admin-only cross-tenant override; ignored for other roles. */
  organizationId: objectIdSchema.optional(),
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
