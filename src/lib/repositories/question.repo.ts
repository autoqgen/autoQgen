import { Types, type QueryFilter as FilterQuery, type SortOrder } from "mongoose";

import { Question, type IQuestion } from "@/models";

/**
 * Question data access.
 *
 * Reads are lean and projected. The previous project chained seven `populate()`
 * calls on every list request — nine round trips per page — so only the fields
 * a list actually renders are joined here, and only when asked for.
 */

export type QuestionDoc = IQuestion;

export interface QuestionListOptions {
  filter: FilterQuery<IQuestion>;
  skip: number;
  limit: number;
  sort: Record<string, SortOrder> | { score: { $meta: "textScore" } };
  /** Joins the display names used by list views. Off by default. */
  withTaxonomyNames?: boolean;
  textSearch?: boolean;
}

/**
 * Object form rather than a string so the textScore meta-projection can be
 * merged in without a second `.select()` silently overriding it — MongoDB
 * requires the score to be projected before it can be sorted on.
 */
const LIST_PROJECTION: Record<string, 1> = {
  _id: 1,
  "question.text": 1,
  "question.image": 1,
  type: 1,
  difficulty: 1,
  language: 1,
  marks: 1,
  estimatedTime: 1,
  tags: 1,
  status: 1,
  isActive: 1,
  aiGenerated: 1,
  year: 1,
  session: 1,
  source: 1,
  category: 1,
  subject: 1,
  chapter: 1,
  topic: 1,
  board: 1,
  exam: 1,
  createdBy: 1,
  createdAt: 1,
  updatedAt: 1,
};

export const questionRepository = {
  async list(options: QuestionListOptions): Promise<{ items: QuestionDoc[]; total: number }> {
    const projection: Record<string, unknown> = { ...LIST_PROJECTION };
    if (options.textSearch) {
      projection.score = { $meta: "textScore" };
    }

    let query = Question.find(options.filter, projection);

    if (options.withTaxonomyNames) {
      query = query
        .populate("category", "name slug")
        .populate("subject", "name slug")
        .populate("chapter", "name slug chapterNo")
        .populate("topic", "name slug");
    }

    const [items, total] = await Promise.all([
      query
        .sort(options.sort as Record<string, SortOrder>)
        .skip(options.skip)
        .limit(options.limit)
        .lean<QuestionDoc[]>()
        .exec(),
      Question.countDocuments(options.filter).exec(),
    ]);

    return { items, total };
  },

  async findById(
    id: string,
    options?: { withTaxonomyNames?: boolean; organizationId?: string | Types.ObjectId },
  ): Promise<QuestionDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    const filter: FilterQuery<IQuestion> = { _id: new Types.ObjectId(id) };
    if (options?.organizationId) {
      filter.organizationId = new Types.ObjectId(options.organizationId.toString());
    }
    let query = Question.findOne(filter);

    if (options?.withTaxonomyNames) {
      query = query
        .populate("category", "name slug")
        .populate("subject", "name slug")
        .populate("chapter", "name slug chapterNo")
        .populate("topic", "name slug")
        .populate("board", "name shortName")
        .populate("exam", "name year type");
    }

    return query.lean<QuestionDoc>().exec();
  },

  async create(data: Record<string, unknown>): Promise<QuestionDoc> {
    const created = await Question.create(data);
    return created.toObject() as unknown as QuestionDoc;
  },

  /**
   * Unordered bulk insert with per-document error reporting.
   *
   * `rawResult` plus `ordered: false` means a duplicate in position 7 does not
   * discard positions 8..N, and the caller learns exactly which rows failed —
   * the previous project ignored the result entirely and reported partial
   * failures to the user as complete success.
   */
  async insertMany(
    documents: Record<string, unknown>[],
  ): Promise<{ insertedCount: number; failures: { index: number; message: string }[] }> {
    if (documents.length === 0) return { insertedCount: 0, failures: [] };

    try {
      const inserted = await Question.insertMany(documents, {
        ordered: false,
        rawResult: false,
      });
      return { insertedCount: inserted.length, failures: [] };
    } catch (error: unknown) {
      const bulkError = error as {
        insertedDocs?: unknown[];
        writeErrors?: { index: number; errmsg?: string; err?: { errmsg?: string } }[];
        message?: string;
      };

      const failures = (bulkError.writeErrors ?? []).map((writeError) => ({
        index: writeError.index,
        message:
          writeError.err?.errmsg?.includes("duplicate key") ||
          writeError.errmsg?.includes("duplicate key")
            ? "A question with the same text already exists in this chapter."
            : "The database rejected this question.",
      }));

      if (failures.length === 0) throw error;

      return {
        insertedCount: bulkError.insertedDocs?.length ?? documents.length - failures.length,
        failures,
      };
    }
  },

  async updateById(id: string, data: Record<string, unknown>): Promise<QuestionDoc | null> {
    return Question.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
      .lean<QuestionDoc>()
      .exec();
  },

  /** Soft delete. Hard deletion is reserved for a super_admin path in Step 2. */
  async softDeleteById(id: string, actorId: Types.ObjectId): Promise<boolean> {
    const result = await Question.updateOne(
      { _id: id },
      { $set: { isActive: false, updatedBy: actorId } },
    ).exec();
    return result.modifiedCount === 1;
  },

  /**
   * Batched duplicate lookup for bulk import: one query for the whole payload
   * rather than one per item.
   */
  async findExistingHashes(
    hashes: readonly string[],
    organizationId?: string | Types.ObjectId,
  ): Promise<Set<string>> {
    if (hashes.length === 0) return new Set();

    const filter: FilterQuery<IQuestion> = { contentHash: { $in: hashes as string[] } };
    if (organizationId) filter.organizationId = new Types.ObjectId(organizationId.toString());

    const docs = await Question.find(filter)
      .select("contentHash")
      .lean<{ contentHash: string }[]>()
      .exec();

    return new Set(docs.map((doc) => doc.contentHash));
  },

  /**
   * Like `findExistingHashes`, but keeps the matching question id so a caller
   * can link to the existing record (the AI generator's "View Existing").
   * Scoped to one organization — a hash colliding in another tenant is not a
   * duplicate here.
   */
  async findByHashes(
    hashes: readonly string[],
    organizationId: string | Types.ObjectId,
  ): Promise<Map<string, string>> {
    if (hashes.length === 0) return new Map();

    const docs = await Question.find({
      contentHash: { $in: hashes as string[] },
      organizationId: new Types.ObjectId(organizationId.toString()),
    })
      .select("_id contentHash")
      .lean<{ _id: Types.ObjectId; contentHash: string }[]>()
      .exec();

    return new Map(docs.map((doc) => [doc.contentHash, doc._id.toString()]));
  },

  /** Status/active check for a batch of ids, used to validate bulk transitions before writing. */
  async findStatusByIds(
    ids: readonly string[],
    organizationId?: string | Types.ObjectId,
  ): Promise<Pick<QuestionDoc, "_id" | "status" | "isActive">[]> {
    if (ids.length === 0) return [];

    const filter: FilterQuery<IQuestion> = {
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    };
    if (organizationId) filter.organizationId = new Types.ObjectId(organizationId.toString());

    return Question.find(filter)
      .select("_id status isActive")
      .lean<Pick<QuestionDoc, "_id" | "status" | "isActive">[]>()
      .exec();
  },

  /** Applies the same status update to every id in one round trip. */
  async updateManyStatus(ids: readonly string[], data: Record<string, unknown>): Promise<number> {
    if (ids.length === 0) return 0;

    const result = await Question.updateMany(
      { _id: { $in: ids.map((id) => new Types.ObjectId(id)) } },
      { $set: data },
    ).exec();
    return result.modifiedCount;
  },

  async countByFilter(filter: FilterQuery<IQuestion>): Promise<number> {
    return Question.countDocuments(filter).exec();
  },

  /**
   * Organization-scoped availability for the paper builder: the count of
   * APPROVED, active questions in a category (and, when a subject is given, in
   * that subject broken down per chapter). One aggregation, no per-chapter
   * round trips. Uses the same eligibility predicate the generator's
   * `baseFilter` applies (organization + isActive + APPROVED).
   */
  async approvedAvailability(params: {
    organizationId: string | Types.ObjectId;
    category?: string | Types.ObjectId | null;
    subject?: string | Types.ObjectId | null;
  }): Promise<{ total: number; byChapter: { chapter: string; count: number }[] }> {
    const match: FilterQuery<IQuestion> = {
      organizationId: new Types.ObjectId(params.organizationId.toString()),
      isActive: true,
      status: "APPROVED",
    };
    if (params.category) match.category = new Types.ObjectId(params.category.toString());
    if (params.subject) match.subject = new Types.ObjectId(params.subject.toString());

    const rows = await Question.aggregate<{ _id: Types.ObjectId | null; count: number }>([
      { $match: match },
      { $group: { _id: "$chapter", count: { $sum: 1 } } },
    ]).exec();

    let total = 0;
    const byChapter: { chapter: string; count: number }[] = [];
    for (const row of rows) {
      total += row.count;
      if (row._id) byChapter.push({ chapter: row._id.toString(), count: row.count });
    }
    return { total, byChapter };
  },

  /**
   * Loads the whole candidate pool for best-match generation — just the fields
   * the ranker needs. Bounded by organization + APPROVED + selected chapters,
   * so the result stays small; capped at `limit` as a safety net.
   */
  async findPool(
    filter: FilterQuery<IQuestion>,
    limit = 5000,
  ): Promise<Pick<QuestionDoc, "_id" | "type" | "difficulty" | "marks" | "chapter" | "topic">[]> {
    return Question.find(filter)
      .select("_id type difficulty marks chapter topic")
      .limit(limit)
      .lean<Pick<QuestionDoc, "_id" | "type" | "difficulty" | "marks" | "chapter" | "topic">[]>()
      .exec();
  },

  /**
   * Randomly samples up to `size` questions matching a filter.
   *
   * Uses the `$sample` aggregation stage so selection happens in the database
   * rather than by fetching a page and shuffling in Node — which is what makes
   * auto-generation viable against a large bank. One aggregation per distinct
   * quota bucket, not one per question.
   */
  async sample(
    filter: FilterQuery<IQuestion>,
    size: number,
  ): Promise<Pick<QuestionDoc, "_id" | "type" | "difficulty" | "marks" | "chapter">[]> {
    if (size <= 0) return [];

    return Question.aggregate<
      Pick<QuestionDoc, "_id" | "type" | "difficulty" | "marks" | "chapter">
    >([
      { $match: filter },
      { $sample: { size } },
      { $project: { _id: 1, type: 1, difficulty: 1, marks: 1, chapter: 1 } },
    ]).exec();
  },

  /** Counts eligible questions per bucket in one pass, for feasibility checks. */
  async countByBucket(
    filter: FilterQuery<IQuestion>,
  ): Promise<{ type: string; difficulty: string | null; count: number }[]> {
    return Question.aggregate<{ type: string; difficulty: string | null; count: number }>([
      { $match: filter },
      { $group: { _id: { type: "$type", difficulty: "$difficulty" }, count: { $sum: 1 } } },
      {
        $project: {
          _id: 0,
          type: "$_id.type",
          difficulty: "$_id.difficulty",
          count: 1,
        },
      },
    ]).exec();
  },

  /** Loads the fields a paper needs when questions are added by id. */
  async findForPaper(
    ids: readonly string[],
    organizationId?: string | Types.ObjectId,
  ): Promise<
    Pick<
      QuestionDoc,
      "_id" | "type" | "difficulty" | "marks" | "status" | "isActive" | "subject" | "chapter" | "organizationId"
    >[]
  > {
    if (ids.length === 0) return [];

    const filter: FilterQuery<IQuestion> = {
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
    };
    if (organizationId) filter.organizationId = new Types.ObjectId(organizationId.toString());

    return Question.find(filter)
      .select("_id type difficulty marks status isActive subject chapter organizationId")
      .lean<
        Pick<
          QuestionDoc,
          | "_id"
          | "type"
          | "difficulty"
          | "marks"
          | "status"
          | "isActive"
          | "subject"
          | "chapter"
          | "organizationId"
        >[]
      >()
      .exec();
  },

  /**
   * The fields the per-paper semantic similarity check needs: the text that is
   * embedded plus `contentHash` (stable pair identity) and the taxonomy/shape
   * fields a replacement must match. Organization-scoped, lean, projected.
   */
  async findEmbeddingSource(
    ids: readonly string[],
    organizationId: string | Types.ObjectId,
  ): Promise<
    Pick<
      QuestionDoc,
      | "_id"
      | "contentHash"
      | "question"
      | "options"
      | "type"
      | "difficulty"
      | "language"
      | "marks"
      | "chapter"
      | "topic"
      | "isActive"
    >[]
  > {
    if (ids.length === 0) return [];
    return Question.find({
      _id: { $in: ids.map((id) => new Types.ObjectId(id)) },
      organizationId: new Types.ObjectId(organizationId.toString()),
    })
      .select("_id contentHash question.text question.passage options.text type difficulty language marks chapter topic isActive")
      .lean<
        Pick<
          QuestionDoc,
          | "_id"
          | "contentHash"
          | "question"
          | "options"
          | "type"
          | "difficulty"
          | "language"
          | "marks"
          | "chapter"
          | "topic"
          | "isActive"
        >[]
      >()
      .exec();
  },
};

export type QuestionRepository = typeof questionRepository;
