import { Types, type QueryFilter as FilterQuery, type SortOrder } from "mongoose";

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
    options?: { populateQuestions?: boolean; withAnswers?: boolean; organizationId?: string | Types.ObjectId },
  ): Promise<PaperDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const rootFilter: FilterQuery<IQuestionPaper> = { _id: new Types.ObjectId(id) };
    if (options?.organizationId) {
      rootFilter.organizationId = new Types.ObjectId(options.organizationId.toString());
    }
    let query = QuestionPaper.findOne(rootFilter);

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
    organizationId?: string | Types.ObjectId,
  ): Promise<Pick<
    PaperDoc,
    "_id" | "createdBy" | "status" | "isActive" | "title" | "organizationId"
  > | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const filter: FilterQuery<IQuestionPaper> = { _id: new Types.ObjectId(id) };
    if (organizationId) filter.organizationId = new Types.ObjectId(organizationId.toString());

    return QuestionPaper.findOne(filter)
      .select("_id createdBy status isActive title organizationId")
      .lean<
        Pick<
          PaperDoc,
          "_id" | "createdBy" | "status" | "isActive" | "title" | "organizationId"
        >
      >()
      .exec();
  },

  async create(data: Record<string, unknown>): Promise<PaperDoc> {
    const created = await QuestionPaper.create(data);
    return created.toObject() as unknown as PaperDoc;
  },

  /**
   * The fields needed to regenerate a paper — the persisted generation config
   * plus the taxonomy/lineage anchors — without populating anything. Scoped to
   * the organization so a caller can only regenerate a paper in their own
   * organization context.
   */
  async findGenerationMeta(
    id: string,
    organizationId: string | Types.ObjectId,
  ): Promise<Pick<
    PaperDoc,
    | "_id" | "organizationId" | "title" | "status" | "isActive" | "mode"
    | "category" | "subject" | "board" | "exam" | "year"
    | "generationSpec" | "designConfig" | "createdBy" | "previousUsageDecision"
  > | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return QuestionPaper.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId.toString()),
    })
      .select(
        "_id organizationId title status isActive mode category subject board exam year generationSpec designConfig createdBy previousUsageDecision",
      )
      .lean<Pick<
        PaperDoc,
        | "_id" | "organizationId" | "title" | "status" | "isActive" | "mode"
        | "category" | "subject" | "board" | "exam" | "year"
        | "generationSpec" | "designConfig" | "createdBy" | "previousUsageDecision"
      >>()
      .exec();
  },

  async updateById(id: string, data: Record<string, unknown>): Promise<PaperDoc | null> {
    return QuestionPaper.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
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
