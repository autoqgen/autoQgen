import { Types } from "mongoose";

import { QuestionUsage, type PaperType } from "@/models";

/**
 * Question-usage history data access.
 *
 * Every method takes an `organizationId` and filters on it — usage from another
 * tenant is never counted, read or exposed.
 */

export interface UsageEntry {
  questionId: string | Types.ObjectId;
  questionPaperId: string | Types.ObjectId;
  organizationId: string | Types.ObjectId;
  paperType: PaperType;
  usedAt: Date;
  createdBy?: string | Types.ObjectId | null;
}

export interface QuestionUsageStat {
  count: number;
  lastUsedAt: Date;
  lastPaperId: string;
  lastPaperType: PaperType;
}

function oid(value: string | Types.ObjectId): Types.ObjectId {
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
}

export const questionUsageRepository = {
  /** Idempotent: re-recording the same (question, paper) pair is a no-op. */
  async recordMany(entries: UsageEntry[]): Promise<number> {
    if (entries.length === 0) return 0;

    const result = await QuestionUsage.bulkWrite(
      entries.map((entry) => ({
        updateOne: {
          filter: { questionId: oid(entry.questionId), questionPaperId: oid(entry.questionPaperId) },
          update: {
            $setOnInsert: {
              questionId: oid(entry.questionId),
              questionPaperId: oid(entry.questionPaperId),
              organizationId: oid(entry.organizationId),
              paperType: entry.paperType,
              usedAt: entry.usedAt,
              createdBy: entry.createdBy ? oid(entry.createdBy) : null,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    return result.upsertedCount ?? 0;
  },

  /**
   * Per-question usage rollup for one organization, over an optional window of
   * the most recent `withinPapers` distinct papers (0/undefined = all history).
   */
  async statsForQuestions(
    organizationId: string | Types.ObjectId,
    questionIds: readonly (string | Types.ObjectId)[],
    withinPapers = 0,
  ): Promise<Map<string, QuestionUsageStat>> {
    if (questionIds.length === 0) return new Map();

    const org = oid(organizationId);
    const ids = questionIds.map(oid);

    let paperScope: Types.ObjectId[] | null = null;
    if (withinPapers > 0) {
      paperScope = await this.recentPaperIds(org, withinPapers);
      if (paperScope.length === 0) return new Map();
    }

    const match: Record<string, unknown> = { organizationId: org, questionId: { $in: ids } };
    if (paperScope) match.questionPaperId = { $in: paperScope };

    const rows = await QuestionUsage.aggregate<{
      _id: Types.ObjectId;
      count: number;
      lastUsedAt: Date;
      lastPaperId: Types.ObjectId;
      lastPaperType: PaperType;
    }>([
      { $match: match },
      { $sort: { usedAt: -1 } },
      {
        $group: {
          _id: "$questionId",
          count: { $sum: 1 },
          lastUsedAt: { $first: "$usedAt" },
          lastPaperId: { $first: "$questionPaperId" },
          lastPaperType: { $first: "$paperType" },
        },
      },
    ]).exec();

    return new Map(
      rows.map((row) => [
        row._id.toString(),
        {
          count: row.count,
          lastUsedAt: row.lastUsedAt,
          lastPaperId: row.lastPaperId.toString(),
          lastPaperType: row.lastPaperType,
        },
      ]),
    );
  },

  /** The organization's `limit` most recently used distinct paper ids. */
  async recentPaperIds(
    organizationId: string | Types.ObjectId,
    limit: number,
  ): Promise<Types.ObjectId[]> {
    if (limit <= 0) return [];

    const rows = await QuestionUsage.aggregate<{ _id: Types.ObjectId; usedAt: Date }>([
      { $match: { organizationId: oid(organizationId) } },
      { $group: { _id: "$questionPaperId", usedAt: { $max: "$usedAt" } } },
      { $sort: { usedAt: -1 } },
      { $limit: limit },
    ]).exec();

    return rows.map((row) => row._id);
  },

  /**
   * Removes every usage row for the given papers in one organization. Used when
   * a paper is deleted, or when a superseded regeneration round in a lineage
   * must stop counting as historical usage.
   */
  async deleteForPapers(
    organizationId: string | Types.ObjectId,
    paperIds: readonly (string | Types.ObjectId)[],
  ): Promise<number> {
    if (paperIds.length === 0) return 0;
    const result = await QuestionUsage.deleteMany({
      organizationId: oid(organizationId),
      questionPaperId: { $in: paperIds.map(oid) },
    }).exec();
    return result.deletedCount ?? 0;
  },

  /**
   * Drops usage rows for one paper whose question is no longer in `keepQuestionIds`.
   * Paired with `recordMany` this makes a paper's usage exactly match its final
   * question set after an edit.
   */
  async deleteForPaperExcept(
    organizationId: string | Types.ObjectId,
    questionPaperId: string | Types.ObjectId,
    keepQuestionIds: readonly (string | Types.ObjectId)[],
  ): Promise<number> {
    const result = await QuestionUsage.deleteMany({
      organizationId: oid(organizationId),
      questionPaperId: oid(questionPaperId),
      questionId: { $nin: keepQuestionIds.map(oid) },
    }).exec();
    return result.deletedCount ?? 0;
  },

  /** The `paperType` already recorded for a paper, if any usage row exists. */
  async paperTypeFor(
    organizationId: string | Types.ObjectId,
    questionPaperId: string | Types.ObjectId,
  ): Promise<PaperType | null> {
    const row = await QuestionUsage.findOne({
      organizationId: oid(organizationId),
      questionPaperId: oid(questionPaperId),
    })
      .select("paperType")
      .lean<{ paperType: PaperType }>()
      .exec();
    return row?.paperType ?? null;
  },

  /** Question ids that appear in any of the given papers, for one organization. */
  async questionIdsInPapers(
    organizationId: string | Types.ObjectId,
    paperIds: readonly (string | Types.ObjectId)[],
  ): Promise<Set<string>> {
    if (paperIds.length === 0) return new Set();

    const rows = await QuestionUsage.find({
      organizationId: oid(organizationId),
      questionPaperId: { $in: paperIds.map(oid) },
    })
      .select("questionId")
      .lean<{ questionId: Types.ObjectId }[]>()
      .exec();

    return new Set(rows.map((row) => row.questionId.toString()));
  },
};

export type QuestionUsageRepository = typeof questionUsageRepository;
