import { Types, type Model } from "mongoose";
type FilterQuery<T> = Record<string, any>;

import { Board, Category, Chapter, Exam, Subject, Topic } from "@/models";

/**
 * Shared shape across all six taxonomy collections.
 *
 * The concrete models are structurally compatible with this base; the casts
 * below are narrowing casts to a documented common interface, not `any`.
 */
export interface TaxonomyDoc {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  category?: Types.ObjectId | null;
  subject?: Types.ObjectId | null;
  chapter?: Types.ObjectId | null;
  board?: Types.ObjectId | null;
}

export type TaxonomyModel = Model<TaxonomyDoc>;

export const TAXONOMY_MODELS = {
  category: Category as unknown as TaxonomyModel,
  subject: Subject as unknown as TaxonomyModel,
  chapter: Chapter as unknown as TaxonomyModel,
  topic: Topic as unknown as TaxonomyModel,
  board: Board as unknown as TaxonomyModel,
  exam: Exam as unknown as TaxonomyModel,
} as const;

export type TaxonomyKind = keyof typeof TAXONOMY_MODELS;

export interface ListOptions {
  filter: FilterQuery<TaxonomyDoc>;
  skip: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
}

export const taxonomyRepository = {
  model(kind: TaxonomyKind): TaxonomyModel {
    return TAXONOMY_MODELS[kind];
  },

  async list(
    kind: TaxonomyKind,
    options: ListOptions,
  ): Promise<{ items: TaxonomyDoc[]; total: number }> {
    const model = TAXONOMY_MODELS[kind];

    // Run the page query and the count concurrently rather than sequentially.
    const [items, total] = await Promise.all([
      model
        .find(options.filter)
        .sort(options.sort ?? { order: 1, name: 1 })
        .skip(options.skip)
        .limit(options.limit)
        .lean<TaxonomyDoc[]>()
        .exec(),
      model.countDocuments(options.filter).exec(),
    ]);

    return { items, total };
  },

  async findById(kind: TaxonomyKind, id: string): Promise<TaxonomyDoc | null> {
    return TAXONOMY_MODELS[kind].findById(id).lean<TaxonomyDoc>().exec();
  },

  async findOne(
    kind: TaxonomyKind,
    filter: FilterQuery<TaxonomyDoc>,
  ): Promise<TaxonomyDoc | null> {
    return TAXONOMY_MODELS[kind].findOne(filter).lean<TaxonomyDoc>().exec();
  },

  async create(kind: TaxonomyKind, data: Record<string, unknown>): Promise<TaxonomyDoc> {
    const created = await TAXONOMY_MODELS[kind].create(data);
    return created.toObject() as unknown as TaxonomyDoc;
  },

  async updateById(
    kind: TaxonomyKind,
    id: string,
    data: Record<string, unknown>,
  ): Promise<TaxonomyDoc | null> {
    return TAXONOMY_MODELS[kind]
      .findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
      .lean<TaxonomyDoc>()
      .exec();
  },

  /** Soft delete — history and existing question references are preserved. */
  async deactivateById(kind: TaxonomyKind, id: string): Promise<boolean> {
    const result = await TAXONOMY_MODELS[kind]
      .updateOne({ _id: id }, { $set: { isActive: false } })
      .exec();
    return result.modifiedCount === 1;
  },

  /**
   * Batched existence check.
   *
   * Returns only `_id`, projected and lean. The previous project called
   * `findById` per reference per item, fetching whole documents merely to prove
   * they existed — 8 round trips per bulk-import row.
   */
  async findExistingIds(kind: TaxonomyKind, ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set();

    const docs = await TAXONOMY_MODELS[kind]
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select("_id")
      .lean<{ _id: Types.ObjectId }[]>()
      .exec();

    return new Set(docs.map((doc) => doc._id.toString()));
  },

  /**
   * Loads the parent-reference fields needed to verify hierarchy consistency in
   * one query per collection, regardless of how many items reference them.
   */
  async findHierarchyRefs(
    kind: TaxonomyKind,
    ids: readonly string[],
  ): Promise<Map<string, TaxonomyDoc>> {
    if (ids.length === 0) return new Map();

    const docs = await TAXONOMY_MODELS[kind]
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select("_id name slug category subject chapter board isActive")
      .lean<TaxonomyDoc[]>()
      .exec();

    return new Map(docs.map((doc) => [doc._id.toString(), doc]));
  },
};

export type TaxonomyRepository = typeof taxonomyRepository;
