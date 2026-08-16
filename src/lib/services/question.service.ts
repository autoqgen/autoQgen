import { Types, type SortOrder } from "mongoose";
type FilterQuery<T> = Record<string, any>;

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type FieldIssue,
} from "@/lib/errors/app-error";
import { assertPermission, type AuthContext } from "@/lib/auth/session";
import { can, canActOnResource, canReadAnswers } from "@/lib/auth/rbac";
import { questionContentHash } from "@/lib/security/hash";
import { questionRepository, type QuestionDoc } from "@/lib/repositories/question.repo";
import { taxonomyRepository } from "@/lib/repositories/taxonomy.repo";
import { toSkip } from "@/lib/validation/common";
import { logger } from "@/lib/logger";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import { canTransition, OPTION_BASED_TYPES, type QuestionStatus, type QuestionType } from "@/types/question";
import type { IQuestion } from "@/models";
import type {
  CreateQuestionInput,
  QuestionListQuery,
  UpdateQuestionInput,
} from "@/lib/validation/question.schema";

/* ==========================================================================
   Answer-shape rules

   These are business rules, not transport concerns, so they live here and are
   shared by create, update and bulk import. The previous project duplicated
   this switch verbatim across two route files — and the copies had already
   diverged, one keyed on an enum and the other on string literals.
   ========================================================================== */

export interface AnswerLike {
  text: string;
  correctOptions: string[];
  booleanAnswer: boolean | null;
  matchingPairs: { left: string; right: string }[];
}

export interface OptionLike {
  id: string;
  text: string;
}

export function validateAnswerForType(
  type: QuestionType,
  options: OptionLike[],
  answer: AnswerLike,
): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const optionIds = new Set(options.map((option) => option.id.toUpperCase()));

  const requireOptions = (min: number) => {
    if (options.length < min) {
      issues.push({ path: "options", message: `This question type requires at least ${min} options.` });
    }
    const duplicates = options.length !== optionIds.size;
    if (duplicates) {
      issues.push({ path: "options", message: "Option identifiers must be unique." });
    }
  };

  const requireCorrectOptionsWithin = () => {
    for (const id of answer.correctOptions) {
      if (!optionIds.has(id.toUpperCase())) {
        issues.push({
          path: "answer.correctOptions",
          message: `Correct option "${id}" is not present in the option list.`,
        });
      }
    }
  };

  switch (type) {
    case "MCQ":
      requireOptions(2);
      if (answer.correctOptions.length !== 1) {
        issues.push({
          path: "answer.correctOptions",
          message: "An MCQ requires exactly one correct option.",
        });
      }
      requireCorrectOptionsWithin();
      break;

    case "MULTIPLE_CORRECT":
      requireOptions(2);
      if (answer.correctOptions.length < 2) {
        issues.push({
          path: "answer.correctOptions",
          message: "A multiple-correct question requires at least two correct options.",
        });
      }
      requireCorrectOptionsWithin();
      break;

    case "ASSERTION_REASON":
      requireOptions(2);
      if (answer.correctOptions.length !== 1) {
        issues.push({
          path: "answer.correctOptions",
          message: "An assertion-reason question requires exactly one correct option.",
        });
      }
      requireCorrectOptionsWithin();
      break;

    case "TRUE_FALSE":
      if (typeof answer.booleanAnswer !== "boolean") {
        issues.push({
          path: "answer.booleanAnswer",
          message: "A true/false question requires booleanAnswer to be true or false.",
        });
      }
      break;

    case "MATCHING":
      if (answer.matchingPairs.length < 2) {
        issues.push({
          path: "answer.matchingPairs",
          message: "A matching question requires at least two pairs.",
        });
      }
      break;

    case "SHORT":
    case "WRITTEN":
    case "FILL_BLANK":
    case "IMAGE":
    case "PASSAGE":
      if (!answer.text.trim()) {
        issues.push({ path: "answer.text", message: "This question type requires answer text." });
      }
      break;

    default:
      issues.push({ path: "type", message: "Unsupported question type." });
  }

  if (!OPTION_BASED_TYPES.includes(type) && options.length > 0) {
    issues.push({ path: "options", message: "This question type does not take options." });
  }

  return issues;
}

/* ==========================================================================
   Taxonomy hierarchy validation

   Batched by design: one query per collection for an entire payload, rather
   than the previous project's ~8 sequential `findById` round trips per item
   (≈8,000 round trips for a 1,000-row import).
   ========================================================================== */

interface TaxonomyRefs {
  category: string;
  subject: string;
  chapter: string;
  topic: string | null;
  board: string | null;
  exam: string | null;
}

export interface HierarchyContext {
  categories: Set<string>;
  subjects: Map<string, { category?: string }>;
  chapters: Map<string, { category?: string; subject?: string }>;
  topics: Map<string, { chapter?: string }>;
  boards: Set<string>;
  exams: Set<string>;
}

export async function loadHierarchyContext(refs: TaxonomyRefs[]): Promise<HierarchyContext> {
  const unique = (values: (string | null)[]) =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value))));

  const [categories, subjects, chapters, topics, boards, exams] = await Promise.all([
    taxonomyRepository.findExistingIds("category", unique(refs.map((ref) => ref.category))),
    taxonomyRepository.findHierarchyRefs("subject", unique(refs.map((ref) => ref.subject))),
    taxonomyRepository.findHierarchyRefs("chapter", unique(refs.map((ref) => ref.chapter))),
    taxonomyRepository.findHierarchyRefs("topic", unique(refs.map((ref) => ref.topic))),
    taxonomyRepository.findExistingIds("board", unique(refs.map((ref) => ref.board))),
    taxonomyRepository.findExistingIds("exam", unique(refs.map((ref) => ref.exam))),
  ]);

  return {
    categories,
    subjects: new Map(
      Array.from(subjects.entries()).map(([id, doc]) => [
        id,
        { category: doc.category?.toString() },
      ]),
    ),
    chapters: new Map(
      Array.from(chapters.entries()).map(([id, doc]) => [
        id,
        { category: doc.category?.toString(), subject: doc.subject?.toString() },
      ]),
    ),
    topics: new Map(
      Array.from(topics.entries()).map(([id, doc]) => [id, { chapter: doc.chapter?.toString() }]),
    ),
    boards,
    exams,
  };
}

export function validateHierarchyRefs(refs: TaxonomyRefs, context: HierarchyContext): FieldIssue[] {
  const issues: FieldIssue[] = [];

  if (!context.categories.has(refs.category)) {
    issues.push({ path: "category", message: "The selected category does not exist." });
  }

  const subject = context.subjects.get(refs.subject);
  if (!subject) {
    issues.push({ path: "subject", message: "The selected subject does not exist." });
  } else if (subject.category && subject.category !== refs.category) {
    issues.push({
      path: "subject",
      message: "The selected subject does not belong to the selected category.",
    });
  }

  const chapter = context.chapters.get(refs.chapter);
  if (!chapter) {
    issues.push({ path: "chapter", message: "The selected chapter does not exist." });
  } else {
    if (chapter.subject && chapter.subject !== refs.subject) {
      issues.push({
        path: "chapter",
        message: "The selected chapter does not belong to the selected subject.",
      });
    }
    if (chapter.category && chapter.category !== refs.category) {
      issues.push({
        path: "chapter",
        message: "The selected chapter does not belong to the selected category.",
      });
    }
  }

  if (refs.topic) {
    const topic = context.topics.get(refs.topic);
    if (!topic) {
      issues.push({ path: "topic", message: "The selected topic does not exist." });
    } else if (topic.chapter && topic.chapter !== refs.chapter) {
      issues.push({
        path: "topic",
        message: "The selected topic does not belong to the selected chapter.",
      });
    }
  }

  if (refs.board && !context.boards.has(refs.board)) {
    issues.push({ path: "board", message: "The selected board does not exist." });
  }
  if (refs.exam && !context.exams.has(refs.exam)) {
    issues.push({ path: "exam", message: "The selected exam does not exist." });
  }

  return issues;
}

function toRefs(input: CreateQuestionInput): TaxonomyRefs {
  return {
    category: input.category,
    subject: input.subject,
    chapter: input.chapter,
    topic: input.topic ?? null,
    board: input.board ?? null,
    exam: input.exam ?? null,
  };
}

/* ==========================================================================
   Answer-key protection
   ========================================================================== */

export type PresentedQuestion = Omit<Partial<QuestionDoc>, "answer"> & {
  answer?: IQuestion["answer"];
  /** True when the caller was authorised to receive the answer key. */
  answersIncluded: boolean;
};

/**
 * The single place a question is shaped for a response.
 *
 * Answers are opt-in AND permission-gated: `withAnswers=true` alone never
 * unlocks them. The previous project returned the full answer key from an
 * unauthenticated endpoint.
 */
export function presentQuestion(
  doc: QuestionDoc,
  options: { actor: AuthContext | null; requestAnswers: boolean },
): PresentedQuestion {
  const allowed = Boolean(options.actor && canReadAnswers(options.actor.role));
  const include = allowed && options.requestAnswers;

  const { answer: _answer, contentHash: _contentHash, ...rest } = doc as QuestionDoc & {
    contentHash?: string;
  };

  const presented: PresentedQuestion = {
    ...rest,
    answersIncluded: include,
  };

  if (include) {
    presented.answer = doc.answer;
  } else {
    // Explanations frequently restate the answer, so they follow the same gate.
    presented.explanation = "";
  }

  return presented;
}

/* ==========================================================================
   Query building
   ========================================================================== */

function buildListFilter(query: QuestionListQuery, actor: AuthContext | null): FilterQuery<IQuestion> {
  const filter: FilterQuery<IQuestion> = { isActive: true };

  if (query.category) filter.category = new Types.ObjectId(query.category);
  if (query.subject) filter.subject = new Types.ObjectId(query.subject);
  if (query.chapter) filter.chapter = new Types.ObjectId(query.chapter);
  if (query.topic) filter.topic = new Types.ObjectId(query.topic);
  if (query.board) filter.board = new Types.ObjectId(query.board);
  if (query.exam) filter.exam = new Types.ObjectId(query.exam);

  if (query.type) filter.type = query.type;
  if (query.difficulty) filter.difficulty = query.difficulty;
  if (query.language) filter.language = query.language;
  if (query.year !== undefined) filter.year = query.year;
  if (query.aiGenerated !== undefined) filter.aiGenerated = query.aiGenerated;
  if (query.tags && query.tags.length > 0) filter.tags = { $in: query.tags };

  if (query.mine && actor) {
    filter.createdBy = actor.objectId;
  }

  /**
   * Status visibility.
   *
   * Callers who cannot review only ever see APPROVED questions, plus their own
   * drafts when they explicitly ask for `mine=true`.
   */
  const isReviewer = Boolean(actor && can(actor.role, "question:review"));

  if (query.status) {
    if (!isReviewer && query.status !== "APPROVED" && !query.mine) {
      throw new ForbiddenError("You may only browse approved questions.");
    }
    filter.status = query.status;
  } else if (!isReviewer && !query.mine) {
    filter.status = "APPROVED";
  }

  if (query.search) {
    // $text uses the compound text index. No RegExp is constructed from user
    // input anywhere in this file.
    filter.$text = { $search: query.search };
  }

  return filter;
}

function buildSort(query: QuestionListQuery): Record<string, SortOrder> {
  if (query.search && query.sort === "relevance") {
    return { score: { $meta: "textScore" } } as unknown as Record<string, SortOrder>;
  }
  return query.sort === "oldest" ? { createdAt: 1 } : { createdAt: -1 };
}

/* ==========================================================================
   Service
   ========================================================================== */

export interface BulkImportItemError {
  index: number;
  message: string;
  details?: FieldIssue[];
}

export interface BulkImportResult {
  received: number;
  inserted: number;
  failed: number;
  errors: BulkImportItemError[];
}

export interface BulkReviewSkip {
  id: string;
  reason: string;
}

export interface BulkReviewResult {
  requested: number;
  updated: number;
  skipped: BulkReviewSkip[];
}

/**
 * super_admin may set DRAFT straight to APPROVED/REJECTED, skipping the
 * PENDING step everyone else must go through.
 */
function canForceReview(actor: AuthContext): boolean {
  return actor.role === "super_admin";
}

function assertStatusAllowed(actor: AuthContext, status: QuestionStatus): void {
  if ((status === "APPROVED" || status === "REJECTED") && !can(actor.role, "question:review")) {
    throw new ForbiddenError("You do not have permission to set this review status.");
  }
}

export const questionService = {
  async list(
    query: QuestionListQuery,
    actor: AuthContext | null,
  ): Promise<{ items: PresentedQuestion[]; total: number }> {
    const filter = buildListFilter(query, actor);

    const { items, total } = await questionRepository.list({
      filter,
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
      sort: buildSort(query),
      withTaxonomyNames: true,
      textSearch: Boolean(query.search && query.sort === "relevance"),
    });

    return {
      items: items.map((doc) =>
        presentQuestion(doc, { actor, requestAnswers: query.withAnswers === true }),
      ),
      total,
    };
  },

  async getById(
    id: string,
    actor: AuthContext | null,
    options: { requestAnswers: boolean },
  ): Promise<PresentedQuestion> {
    const doc = await questionRepository.findById(id, { withTaxonomyNames: true });
    if (!doc || !doc.isActive) throw new NotFoundError("Question");

    const isOwner = actor ? doc.createdBy?.toString() === actor.id : false;
    const isReviewer = Boolean(actor && can(actor.role, "question:review"));

    if (doc.status !== "APPROVED" && !isOwner && !isReviewer) {
      throw new NotFoundError("Question");
    }

    return presentQuestion(doc, { actor, requestAnswers: options.requestAnswers });
  },

  async create(
    input: CreateQuestionInput,
    actor: AuthContext,
    context?: AuditContext,
  ): Promise<PresentedQuestion> {
    assertPermission(actor, "question:create");
    assertStatusAllowed(actor, input.status);

    const hierarchyContext = await loadHierarchyContext([toRefs(input)]);
    const hierarchyIssues = validateHierarchyRefs(toRefs(input), hierarchyContext);
    if (hierarchyIssues.length > 0) {
      throw new ValidationError("The selected taxonomy is invalid.", hierarchyIssues);
    }

    const answerIssues = validateAnswerForType(input.type, input.options, input.answer);
    if (answerIssues.length > 0) {
      throw new ValidationError("The answer does not match the question type.", answerIssues);
    }

    const contentHash = questionContentHash(input.chapter, input.question.text);

    const existing = await questionRepository.findExistingHashes([contentHash]);
    if (existing.has(contentHash)) {
      throw new ConflictError("A question with this text already exists in this chapter.");
    }

    const doc = await questionRepository.create({
      ...input,
      contentHash,
      // Derived from the session — never accepted from the request body.
      createdBy: actor.objectId,
      updatedBy: null,
      approvedBy: null,
    });

    logger.info("Question created", { questionId: doc._id.toString(), actorId: actor.id });

    if (context) {
      await auditService.record(
        {
          action: "question.create",
          resourceType: "question",
          resourceId: doc._id.toString(),
          metadata: { type: doc.type, status: doc.status, chapter: doc.chapter?.toString() },
        },
        context,
      );
    }

    return presentQuestion(doc, { actor, requestAnswers: true });
  },

  async update(
    id: string,
    input: UpdateQuestionInput,
    actor: AuthContext,
    context?: AuditContext,
  ): Promise<PresentedQuestion> {
    const existing = await questionRepository.findById(id);
    if (!existing || !existing.isActive) throw new NotFoundError("Question");

    const ownerId = existing.createdBy?.toString() ?? "";
    if (!canActOnResource(actor.role, "update", actor.id, ownerId)) {
      throw new ForbiddenError("You may only edit questions you created.");
    }

    if (input.status) {
      assertStatusAllowed(actor, input.status);
      if (!canForceReview(actor) && !canTransition(existing.status, input.status)) {
        throw new ValidationError("That status change is not allowed.", [
          { path: "status", message: `Cannot move from ${existing.status} to ${input.status}.` },
        ]);
      }
    }

    const merged = {
      category: input.category ?? existing.category.toString(),
      subject: input.subject ?? existing.subject.toString(),
      chapter: input.chapter ?? existing.chapter.toString(),
      topic: input.topic ?? existing.topic?.toString() ?? null,
      board: input.board ?? existing.board?.toString() ?? null,
      exam: input.exam ?? existing.exam?.toString() ?? null,
    };

    const hierarchyContext = await loadHierarchyContext([merged]);
    const hierarchyIssues = validateHierarchyRefs(merged, hierarchyContext);
    if (hierarchyIssues.length > 0) {
      throw new ValidationError("The selected taxonomy is invalid.", hierarchyIssues);
    }

    const type = input.type ?? existing.type;
    const options = input.options ?? existing.options;
    const answer = input.answer ?? existing.answer;

    const answerIssues = validateAnswerForType(type, options, answer);
    if (answerIssues.length > 0) {
      throw new ValidationError("The answer does not match the question type.", answerIssues);
    }

    const update: Record<string, unknown> = { ...input, updatedBy: actor.objectId };

    // Text or chapter changes invalidate the duplicate fingerprint.
    if (input.question?.text || input.chapter) {
      const text = input.question?.text ?? existing.question.text;
      update.contentHash = questionContentHash(merged.chapter, text);
    }

    if (input.status === "APPROVED") {
      update.approvedBy = actor.objectId;
      update.approvedAt = new Date();
    }

    const updated = await questionRepository.updateById(id, update);
    if (!updated) throw new NotFoundError("Question");

    logger.info("Question updated", { questionId: id, actorId: actor.id });

    if (context) {
      await auditService.record(
        {
          action: input.status ? "question.status.change" : "question.update",
          resourceType: "question",
          resourceId: id,
          metadata: input.status
            ? { from: existing.status, to: input.status, note: Boolean(input.reviewNote) }
            : { fields: Object.keys(input).length },
        },
        context,
      );
    }

    return presentQuestion(updated, { actor, requestAnswers: true });
  },

  async remove(id: string, actor: AuthContext, context?: AuditContext): Promise<void> {
    const existing = await questionRepository.findById(id);
    if (!existing || !existing.isActive) throw new NotFoundError("Question");

    const ownerId = existing.createdBy?.toString() ?? "";
    if (!canActOnResource(actor.role, "delete", actor.id, ownerId)) {
      throw new ForbiddenError("You may only delete questions you created.");
    }

    await questionRepository.softDeleteById(id, actor.objectId);
    logger.info("Question deactivated", { questionId: id, actorId: actor.id });

    if (context) {
      await auditService.record(
        { action: "question.delete", resourceType: "question", resourceId: id },
        context,
      );
    }
  },

  /**
   * Bulk import.
   *
   * Cost is a constant number of queries regardless of payload size: six
   * taxonomy lookups, one duplicate-hash lookup, one insertMany.
   */
  async bulkCreate(
    inputs: CreateQuestionInput[],
    actor: AuthContext,
    context?: AuditContext,
  ): Promise<BulkImportResult> {
    assertPermission(actor, "question:bulk-import");

    const errors: BulkImportItemError[] = [];
    const hierarchyContext = await loadHierarchyContext(inputs.map(toRefs));

    interface Candidate {
      index: number;
      hash: string;
      document: Record<string, unknown>;
    }

    const candidates: Candidate[] = [];
    const seenInPayload = new Map<string, number>();

    inputs.forEach((input, index) => {
      const issues: FieldIssue[] = [
        ...validateHierarchyRefs(toRefs(input), hierarchyContext),
        ...validateAnswerForType(input.type, input.options, input.answer),
      ];

      if (input.status === "APPROVED" || input.status === "REJECTED") {
        if (!can(actor.role, "question:review")) {
          issues.push({ path: "status", message: "You may not import questions in this status." });
        }
      }

      if (issues.length > 0) {
        errors.push({ index, message: "Validation failed.", details: issues });
        return;
      }

      const hash = questionContentHash(input.chapter, input.question.text);

      const firstSeen = seenInPayload.get(hash);
      if (firstSeen !== undefined) {
        errors.push({
          index,
          message: `Duplicate of item ${firstSeen} within this import.`,
        });
        return;
      }
      seenInPayload.set(hash, index);

      candidates.push({
        index,
        hash,
        document: {
          ...input,
          contentHash: hash,
          createdBy: actor.objectId,
          updatedBy: null,
          approvedBy: null,
        },
      });
    });

    // One query for every candidate hash.
    const existingHashes = await questionRepository.findExistingHashes(
      candidates.map((candidate) => candidate.hash),
    );

    const insertable = candidates.filter((candidate) => {
      if (existingHashes.has(candidate.hash)) {
        errors.push({
          index: candidate.index,
          message: "A question with this text already exists in this chapter.",
        });
        return false;
      }
      return true;
    });

    const { insertedCount, failures } = await questionRepository.insertMany(
      insertable.map((candidate) => candidate.document),
    );

    // Map driver-level failures back to the caller's original indices.
    for (const failure of failures) {
      const candidate = insertable[failure.index];
      errors.push({
        index: candidate?.index ?? failure.index,
        message: failure.message,
      });
    }

    const result: BulkImportResult = {
      received: inputs.length,
      inserted: insertedCount,
      failed: errors.length,
      errors: errors.sort((a, b) => a.index - b.index),
    };

    logger.info("Bulk import completed", {
      actorId: actor.id,
      received: result.received,
      inserted: result.inserted,
      failed: result.failed,
    });

    if (context) {
      await auditService.record(
        {
          action: "question.bulk-import",
          resourceType: "question",
          metadata: {
            received: result.received,
            inserted: result.inserted,
            failed: result.failed,
          },
          outcome: result.failed > 0 ? "failure" : "success",
        },
        context,
      );
    }

    return result;
  },

  /**
   * Bulk approve/reject.
   *
   * One status lookup and one `updateMany` for the whole batch rather than a
   * round trip per question, so approving a page of the review queue in a
   * single click stays a constant number of queries.
   */
  async bulkUpdateStatus(
    ids: string[],
    status: Extract<QuestionStatus, "APPROVED" | "REJECTED">,
    reviewNote: string | undefined,
    actor: AuthContext,
    context?: AuditContext,
  ): Promise<BulkReviewResult> {
    assertPermission(actor, "question:review");

    const unique = Array.from(new Set(ids));
    const existing = await questionRepository.findStatusByIds(unique);
    const existingByStringId = new Map(existing.map((doc) => [doc._id.toString(), doc]));

    const bypass = canForceReview(actor);
    const skipped: BulkReviewSkip[] = [];
    const eligible: string[] = [];

    for (const id of unique) {
      const doc = existingByStringId.get(id);
      if (!doc || !doc.isActive) {
        skipped.push({ id, reason: "Question not found." });
        continue;
      }
      if (!bypass && !canTransition(doc.status, status)) {
        skipped.push({ id, reason: `Cannot move from ${doc.status} to ${status}.` });
        continue;
      }
      eligible.push(id);
    }

    const update: Record<string, unknown> = { status, updatedBy: actor.objectId };
    if (reviewNote !== undefined) update.reviewNote = reviewNote;
    if (status === "APPROVED") {
      update.approvedBy = actor.objectId;
      update.approvedAt = new Date();
    }

    const updated = eligible.length > 0 ? await questionRepository.updateManyStatus(eligible, update) : 0;

    logger.info("Bulk review completed", {
      actorId: actor.id,
      status,
      requested: unique.length,
      updated,
      skipped: skipped.length,
    });

    if (context) {
      await auditService.record(
        {
          action: "question.bulk-review",
          resourceType: "question",
          metadata: { status, requested: unique.length, updated, skipped: skipped.length },
          outcome: skipped.length > 0 ? "failure" : "success",
        },
        context,
      );
    }

    return { requested: unique.length, updated, skipped };
  },
};

export type QuestionService = typeof questionService;
