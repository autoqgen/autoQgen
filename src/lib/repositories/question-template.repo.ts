import { Types, type QueryFilter as FilterQuery, type SortOrder } from "mongoose";

import { QuestionPatternTemplate, type IQuestionPatternTemplate } from "@/models";

/**
 * Question Pattern Template data access.
 *
 * Same discipline as the other repositories: lean reads, explicit projections,
 * concurrent page-and-count, and the only module that touches the
 * QuestionPatternTemplate model.
 */

export type TemplateDoc = IQuestionPatternTemplate;

const LIST_PROJECTION: Record<string, 1> = {
  _id: 1,
  name: 1,
  description: 1,
  category: 1,
  subject: 1,
  generationSpec: 1,
  createdBy: 1,
  createdAt: 1,
  updatedAt: 1,
};

export interface TemplateListOptions {
  filter: FilterQuery<IQuestionPatternTemplate>;
  skip: number;
  limit: number;
  sort: Record<string, SortOrder>;
}

export const questionTemplateRepository = {
  async list(options: TemplateListOptions): Promise<{ items: TemplateDoc[]; total: number }> {
    const [items, total] = await Promise.all([
      QuestionPatternTemplate.find(options.filter, LIST_PROJECTION)
        .populate("subject", "name slug")
        .populate("category", "name slug")
        .populate("createdBy", "name email")
        .sort(options.sort)
        .skip(options.skip)
        .limit(options.limit)
        .lean<TemplateDoc[]>()
        .exec(),
      QuestionPatternTemplate.countDocuments(options.filter).exec(),
    ]);

    return { items, total };
  },

  async findById(id: string, organizationId: string | Types.ObjectId): Promise<TemplateDoc | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return QuestionPatternTemplate.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId.toString()),
      isActive: true,
    })
      .populate("subject", "name slug")
      .populate("category", "name slug")
      .populate("createdBy", "name email")
      .lean<TemplateDoc>()
      .exec();
  },

  /** Minimal read for existence / name-uniqueness checks before a mutation. */
  async findMetaById(
    id: string,
    organizationId: string | Types.ObjectId,
  ): Promise<Pick<TemplateDoc, "_id" | "name" | "organizationId" | "isActive"> | null> {
    if (!Types.ObjectId.isValid(id)) return null;
    return QuestionPatternTemplate.findOne({
      _id: new Types.ObjectId(id),
      organizationId: new Types.ObjectId(organizationId.toString()),
    })
      .select("_id name organizationId isActive")
      .lean<Pick<TemplateDoc, "_id" | "name" | "organizationId" | "isActive">>()
      .exec();
  },

  async nameTaken(
    organizationId: string | Types.ObjectId,
    name: string,
    excludeId?: string,
  ): Promise<boolean> {
    const filter: FilterQuery<IQuestionPatternTemplate> = {
      organizationId: new Types.ObjectId(organizationId.toString()),
      name,
      isActive: true,
    };
    if (excludeId && Types.ObjectId.isValid(excludeId)) {
      filter._id = { $ne: new Types.ObjectId(excludeId) };
    }
    const existing = await QuestionPatternTemplate.exists(filter).exec();
    return Boolean(existing);
  },

  async create(data: Record<string, unknown>): Promise<TemplateDoc> {
    const created = await QuestionPatternTemplate.create(data);
    return created.toObject() as unknown as TemplateDoc;
  },

  async updateById(id: string, data: Record<string, unknown>): Promise<TemplateDoc | null> {
    return QuestionPatternTemplate.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true })
      .lean<TemplateDoc>()
      .exec();
  },

  async softDeleteById(id: string, actorId: Types.ObjectId): Promise<boolean> {
    const result = await QuestionPatternTemplate.updateOne(
      { _id: id },
      { $set: { isActive: false, updatedBy: actorId } },
    ).exec();
    return result.modifiedCount === 1;
  },
};

export type QuestionTemplateRepository = typeof questionTemplateRepository;
