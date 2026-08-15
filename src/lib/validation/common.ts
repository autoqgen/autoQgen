import { z } from "zod";

/**
 * Shared primitives.
 *
 * ObjectId validation is a plain regex rather than a Mongoose call so these
 * schemas can be imported by client components without pulling the driver into
 * the browser bundle.
 */

export const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

export const objectIdSchema = z
  .string()
  .trim()
  .regex(OBJECT_ID_REGEX, "Must be a valid 24-character identifier.");

export const optionalObjectIdSchema = z
  .union([objectIdSchema, z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === "" || value === null ? null : (value ?? null)));

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Slug is required.")
  .max(160)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Slug may contain lowercase letters, digits and single hyphens only.",
  );

export const shortTextSchema = (max: number, label = "Value") =>
  z.string().trim().min(1, `${label} is required.`).max(max, `${label} must be at most ${max} characters.`);

export const optionalTextSchema = (max: number) => z.string().trim().max(max).optional().default("");

export const yearSchema = z
  .number()
  .int()
  .min(1900, "Year must be 1900 or later.")
  .max(2200, "Year must be 2200 or earlier.");

export const routeIdParamsSchema = z.object({
  id: objectIdSchema,
});

export type RouteIdParams = z.infer<typeof routeIdParamsSchema>;

/* ==========================================================================
   Pagination

   Hard ceiling of 100. Invalid or hostile values fall back to the default
   rather than producing NaN (the previous project ran `parseInt(limit)` with no
   guard, so `?limit=abc` reached Mongo as `.limit(NaN)` and `?limit=1000000`
   was honoured verbatim).
   ========================================================================== */

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(100_000).catch(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).catch(DEFAULT_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function toSkip(page: number, limit: number): number {
  return (page - 1) * limit;
}

export const sortOrderSchema = z.enum(["asc", "desc"]).catch("desc").default("desc");

/** Free-text search term. Length-capped; never used to build a RegExp. */
export const searchTermSchema = z.string().trim().min(1).max(120).optional();

/** Comma-separated list of tags, capped so a query cannot fan out unbounded. */
export const tagsQuerySchema = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) =>
    value
      ? value
          .split(",")
          .map((tag) => tag.trim().toLowerCase())
          .filter(Boolean)
          .slice(0, 20)
      : undefined,
  );

export const booleanQuerySchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));
