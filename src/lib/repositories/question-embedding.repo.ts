import { Types } from "mongoose";

import { QuestionEmbedding, type IQuestionEmbedding } from "@/models";

/**
 * Embedding cache access — the only module that touches `QuestionEmbedding`.
 * Every query is organization-scoped.
 */

export type QuestionEmbeddingDoc = IQuestionEmbedding;

export interface EmbeddingUpsert {
  organizationId: string | Types.ObjectId;
  questionId: string | Types.ObjectId;
  sourceHash: string;
  model: string;
  vector: number[];
}

export const questionEmbeddingRepository = {
  /** Cached rows for a set of questions, keyed by questionId string. */
  async findByQuestionIds(
    questionIds: readonly string[],
    organizationId: string | Types.ObjectId,
  ): Promise<Map<string, QuestionEmbeddingDoc>> {
    if (questionIds.length === 0) return new Map();
    const docs = await QuestionEmbedding.find({
      organizationId: new Types.ObjectId(organizationId.toString()),
      questionId: { $in: questionIds.map((id) => new Types.ObjectId(id)) },
    })
      .lean<QuestionEmbeddingDoc[]>()
      .exec();
    return new Map(docs.map((doc) => [doc.questionId.toString(), doc]));
  },

  /** Insert-or-replace one cache row per question. */
  async upsertMany(rows: EmbeddingUpsert[]): Promise<void> {
    if (rows.length === 0) return;
    await QuestionEmbedding.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: {
            organizationId: new Types.ObjectId(row.organizationId.toString()),
            questionId: new Types.ObjectId(row.questionId.toString()),
          },
          update: {
            $set: {
              sourceHash: row.sourceHash,
              model: row.model,
              vector: row.vector,
              dims: row.vector.length,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
  },
};

export type QuestionEmbeddingRepository = typeof questionEmbeddingRepository;
