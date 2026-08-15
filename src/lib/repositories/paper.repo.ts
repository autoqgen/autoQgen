import { Types, type FilterQuery, type SortOrder } from "mongoose";

import { QuestionPaper, type IQuestionPaper } from "@/models";

/**
 * Question paper data access.
 *
 * Same discipline as the Step 1 repositories: lean reads, explicit projections,
 * concurrent page-and-count, and the only module in the codebase that touches
 * the QuestionPaper model.
 */

export type PaperDoc = IQuestionPaper;

const LIST_PROJECTION: Record<string, 1> = {
  _id: 1,
  title: 1,
  description: 1,
  status: 1,
  mode: 1,
  totalMarks: 1,
  totalQuestions: 1,
  durationMinutes: 1,
  version: 1,
  category: 1,
  subject: 1,
  board: 1,
  exam: 1,
  year: 1,
  createdBy: 1,
  createdAt: 1,
  updatedAt: 1,
  publishedAt: 1,
};

export interface PaperListOptions {
  filter: FilterQuery<IQuestionPaper>;
  skip: number;
  limit: number;
  sort: Record<string, SortOrder>;
}

export const paperRepository = {
  async list(options: PaperListOptions): Promise<{ items: PaperDoc[]; total: number }> {
    const [items, total] = await Promise.all([
      QuestionPaper.find(options.filter, LIST_PROJECTION)
        .populate("subject", "name slug")
        .populate("board", "name shortName")
        .sort(options.sort)
        .skip(options.skip)
        .limit(options.limit)
        .lean<PaperDoc[]>()
        .exec(),
      QuestionPaper.countDocuments(options.filter).exec(),
    ]);

    return { items, total };
  },

  /**
   * Full paper with question bodies joined.
   *
   * `withAnswers` controls the projection at the database level rather than
   * stripping after the fact, so an answer key is never loaded into memory for
   * a caller who is not allowed to see it.
   */
  async findById(
    id: string,
    options?: { populateQuestions?: boolean; withAnswers?: boolean },
  ): Promise<PaperDoc | null> {
    let query = QuestionPaper.findById(id);

    if (options?.populateQuestions) {
      const questionFields = options.withAnswers
        ? "question options answer explanation type difficulty marks language tags chapter topic year"
        : "question options type difficulty marks language tags chapter topic year";

      query = query.populate({
        path: "sections.questions.question",
        select: questionFields,
        populate: [
          { path: "chapter", select: "name chapterNo" },
          { path: "topic", select: "name" },
        ],
      });
    }

    return query
      .populate("category", "name slug")
      .populate("subject", "name slug")
      .populate("board", "name shortName")
      .populate("exam", "name year type")
      .lean<PaperDoc>()
      .exec();
  },

  /** Minimal read used for ownership and status checks before a mutation. */
  async findMetaById(
    id: string,
  ): Promise<Pick<PaperDoc, "_id" | "createdBy" | "status" | "isActive" | "version" | "title"> | null> {
    return QuestionPaper.findById(id)
      .select("_id createdBy status isActive version title")
      .lean<Pick<PaperDoc, "_id" | "createdBy" | "status" | "isActive" | "version" | "title">>()
      .exec();
  },

  async create(data: Record<string, unknown>): Promise<PaperDoc> {
    const created = await QuestionPaper.create(data);
    return created.toObject() as unknown as PaperDoc;
  },

  async updateById(id: string, data: Record<string, unknown>): Promise<PaperDoc | null> {
    return QuestionPaper.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
      .lean<PaperDoc>()
      .exec();
  },

  /**
   * Applies an update and appends a version history entry atomically, so the
   * recorded version can never drift from the document it describes.
   */
  async updateWithVersion(
    id: string,
    data: Record<string, unknown>,
    historyEntry: Record<string, unknown>,
  ): Promise<PaperDoc | null> {
    return QuestionPaper.findByIdAndUpdate(
      id,
      {
        $set: data,
        $inc: { version: 1 },
        // Keep the history bounded; the most recent 50 entries are enough.
        $push: { versionHistory: { $each: [historyEntry], $slice: -50 } },
      },
      { new: true, runValidators: true },
    )
      .lean<PaperDoc>()
      .exec();
  },

  async softDeleteById(id: string, actorId: Types.ObjectId): Promise<boolean> {
    const result = await QuestionPaper.updateOne(
      { _id: id },
      { $set: { isActive: false, updatedBy: actorId } },
    ).exec();
    return result.modifiedCount === 1;
  },

  async countByFilter(filter: FilterQuery<IQuestionPaper>): Promise<number> {
    return QuestionPaper.countDocuments(filter).exec();
  },
};

export type PaperRepository = typeof paperRepository;
