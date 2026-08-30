import { z } from "zod";

import {
  objectIdSchema,
  optionalObjectIdSchema,
  optionalTextSchema,
  paginationQuerySchema,
  searchTermSchema,
  shortTextSchema,
  slugSchema,
  yearSchema,
} from "@/lib/validation/common";
import { EXAM_TYPES } from "@/models/Exam";

/**
 * Taxonomy schemas.
 *
 * Six near-identical route files in the previous project each hand-rolled their
 * own checks and drifted apart (the topics route ignored its query parameters
 * entirely, two routes never validated ObjectIds). Defining the shapes once and
 * driving a generic service from them removes that whole class of divergence.
 */

const orderSchema = z.coerce.number().int().min(0).max(100_000).optional().default(0);
const activeSchema = z.boolean().optional();

/**
 * Optional target organization for the four tenant-isolated kinds
 * (category/subject/chapter/topic). Honoured only for a `super_admin` acting
 * across tenants; for everyone else the server derives it from their current
 * organization and any supplied value is ignored.
 */
const orgOverrideSchema = optionalObjectIdSchema;

/* ------------------------------- Category ------------------------------- */

export const createCategorySchema = z.object({
  organizationId: orgOverrideSchema,
  name: shortTextSchema(160, "Name"),
  slug: slugSchema,
  description: optionalTextSchema(2000),
  order: orderSchema,
});

export const updateCategorySchema = createCategorySchema.partial().extend({
  isActive: activeSchema,
});

/* -------------------------------- Subject -------------------------------- */

export const createSubjectSchema = z.object({
  organizationId: orgOverrideSchema,
  name: shortTextSchema(160, "Name"),
  slug: slugSchema,
  code: optionalTextSchema(40),
  category: objectIdSchema,
  classLevel: optionalTextSchema(80),
  group: optionalTextSchema(80),
  order: orderSchema,
});

export const updateSubjectSchema = createSubjectSchema.partial().extend({
  isActive: activeSchema,
});

/* -------------------------------- Chapter -------------------------------- */

export const createChapterSchema = z.object({
  organizationId: orgOverrideSchema,
  name: shortTextSchema(200, "Name"),
  slug: slugSchema,
  chapterNo: z.coerce.number().int().min(0).max(1000).optional().default(0),
  description: optionalTextSchema(2000),
  category: objectIdSchema,
  subject: objectIdSchema,
  order: orderSchema,
});

export const updateChapterSchema = createChapterSchema.partial().extend({
  isActive: activeSchema,
});

/* --------------------------------- Topic --------------------------------- */

export const createTopicSchema = z.object({
  organizationId: orgOverrideSchema,
  name: shortTextSchema(200, "Name"),
  slug: slugSchema,
  description: optionalTextSchema(2000),
  category: objectIdSchema,
  subject: objectIdSchema,
  chapter: objectIdSchema,
  order: orderSchema,
});

export const updateTopicSchema = createTopicSchema.partial().extend({
  isActive: activeSchema,
});

/* --------------------------------- Board --------------------------------- */

export const createBoardSchema = z.object({
  name: shortTextSchema(160, "Name"),
  slug: slugSchema,
  shortName: optionalTextSchema(40),
  country: z.string().trim().max(80).optional().default("Bangladesh"),
  order: orderSchema,
});

export const updateBoardSchema = createBoardSchema.partial().extend({
  isActive: activeSchema,
});

/* ---------------------------------- Exam ---------------------------------- */

export const createExamSchema = z.object({
  name: shortTextSchema(200, "Name"),
  slug: slugSchema,
  type: z.enum(EXAM_TYPES).optional().default("OTHER"),
  category: optionalObjectIdSchema,
  board: optionalObjectIdSchema,
  year: yearSchema.nullable().optional().default(null),
  session: optionalTextSchema(80),
  description: optionalTextSchema(2000),
  order: orderSchema,
});

export const updateExamSchema = createExamSchema.partial().extend({
  isActive: activeSchema,
});

/* --------------------------------- Query --------------------------------- */

export const taxonomyListQuerySchema = paginationQuerySchema.extend({
  search: searchTermSchema,
  /** super_admin-only cross-tenant override; ignored for other roles. */
  organizationId: objectIdSchema.optional(),
  category: objectIdSchema.optional(),
  subject: objectIdSchema.optional(),
  chapter: objectIdSchema.optional(),
  board: objectIdSchema.optional(),
  includeInactive: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export type TaxonomyListQuery = z.infer<typeof taxonomyListQuerySchema>;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type CreateSubjectInput = z.infer<typeof createSubjectSchema>;
export type CreateChapterInput = z.infer<typeof createChapterSchema>;
export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type CreateExamInput = z.infer<typeof createExamSchema>;
