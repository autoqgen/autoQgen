import { Types } from "mongoose";

import { PaperSimilarityReview, type IPaperSimilarityReview } from "@/models";

/**
 * Per-paper similarity-review state — the only module that touches
 * `PaperSimilarityReview`. Organization-scoped.
 */

export type PaperSimilarityReviewDoc = IPaperSimilarityReview;

export const paperSimilarityRepository = {
  async findByPaperId(
    paperId: string | Types.ObjectId,
    organizationId: string | Types.ObjectId,
  ): Promise<PaperSimilarityReviewDoc | null> {
    return PaperSimilarityReview.findOne({
      paperId: new Types.ObjectId(paperId.toString()),
      organizationId: new Types.ObjectId(organizationId.toString()),
    })
      .lean<PaperSimilarityReviewDoc>()
      .exec();
  },

  /** Merge check metadata onto the paper's review doc (creates it if absent). */
  async upsertMeta(
    paperId: string | Types.ObjectId,
    organizationId: string | Types.ObjectId,
    data: Partial<
      Pick<
        IPaperSimilarityReview,
        | "threshold"
        | "model"
        | "signature"
        | "lastQuestionCount"
        | "lastFlaggedCount"
        | "lastCheckedBy"
        | "lastCheckedAt"
      >
    >,
  ): Promise<PaperSimilarityReviewDoc> {
    return PaperSimilarityReview.findOneAndUpdate(
      {
        paperId: new Types.ObjectId(paperId.toString()),
        organizationId: new Types.ObjectId(organizationId.toString()),
      },
      { $set: data },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    )
      .lean<PaperSimilarityReviewDoc>()
      .exec();
  },

  /** Record a "Keep Both" decision for a pair (idempotent on `pairKey`). */
  async addResolvedPair(
    paperId: string | Types.ObjectId,
    organizationId: string | Types.ObjectId,
    pairKey: string,
    resolvedBy: Types.ObjectId | null,
  ): Promise<void> {
    const filter = {
      paperId: new Types.ObjectId(paperId.toString()),
      organizationId: new Types.ObjectId(organizationId.toString()),
    };
    // Ensure the doc exists, then replace any prior record for this pairKey.
    await PaperSimilarityReview.updateOne(filter, { $setOnInsert: filter }, { upsert: true }).exec();
    await PaperSimilarityReview.updateOne(filter, { $pull: { resolvedPairs: { pairKey } } }).exec();
    await PaperSimilarityReview.updateOne(filter, {
      $push: { resolvedPairs: { pairKey, decision: "kept", resolvedBy, resolvedAt: new Date() } },
    }).exec();
  },
};

export type PaperSimilarityRepository = typeof paperSimilarityRepository;
