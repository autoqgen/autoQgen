/**
 * Question paper domain types.
 *
 * Mirrors the pattern used by src/types/question.ts: const tuples drive the
 * TypeScript union, the Zod enum and the Mongoose schema enum from one source.
 */

export const PAPER_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type PaperStatus = (typeof PAPER_STATUSES)[number];

export const PAPER_MODES = ["MANUAL", "AUTO"] as const;
export type PaperMode = (typeof PAPER_MODES)[number];

export const EXPORT_FORMATS = ["pdf", "docx"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_VARIANTS = ["student", "teacher"] as const;
export type ExportVariant = (typeof EXPORT_VARIANTS)[number];

/**
 * Legal status transitions.
 *
 * Publish and archive are reversible; restore returns an archived paper to
 * DRAFT so it must be re-published deliberately rather than silently going live
 * again.
 */
export const PAPER_STATUS_TRANSITIONS: Record<PaperStatus, readonly PaperStatus[]> = {
  DRAFT: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["PUBLISHED", "ARCHIVED", "DRAFT"],
  ARCHIVED: ["ARCHIVED", "DRAFT"],
};

export function canTransitionPaper(from: PaperStatus, to: PaperStatus): boolean {
  return PAPER_STATUS_TRANSITIONS[from].includes(to);
}
