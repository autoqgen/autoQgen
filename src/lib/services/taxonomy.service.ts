import { Types, type FilterQuery } from "mongoose";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { assertPermission, type AuthContext } from "@/lib/auth/session";
import { escapeRegExp } from "@/lib/security/regex";
import {
  taxonomyRepository,
  type TaxonomyDoc,
  type TaxonomyKind,
} from "@/lib/repositories/taxonomy.repo";
import { toSkip } from "@/lib/validation/common";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import type { TaxonomyListQuery } from "@/lib/validation/taxonomy.schema";

/**
 * One generic taxonomy service driving all six collections.
 *
 * The previous project had six route files that were ~85% identical and had
 * already drifted apart: the topics route ignored its query parameters, two
 * routes never validated ObjectIds, and none paginated. Behaviour is defined
 * once here; each resource contributes only its parent-reference rules.
 */

interface ParentRule {
  /** Field on the payload that holds the parent id. */
  field: "category" | "subject" | "chapter" | "board";
  /** Which collection the parent lives in. */
  kind: TaxonomyKind;
  required: boolean;
  /**
   * Fields that must match between the parent document and this payload.
   * This is what makes hierarchy consistency real rather than "the id exists":
   * a chapter's subject must itself sit under the submitted category.
   */
  mustMatch?: ("category" | "subject" | "chapter")[];
}

interface ResourceConfig {
  kind: TaxonomyKind;
  label: string;
  parents: ParentRule[];
  /** Fields forming the uniqueness key, mirroring the database index. */
  uniqueBy: ("slug" | "name")[];
  /** Scope for uniqueness — null means global. */
  uniqueScope: "category" | "subject" | "chapter" | null;
}

export const TAXONOMY_RESOURCES: Record<TaxonomyKind, ResourceConfig> = {
  category: {
    kind: "category",
    label: "Category",
    parents: [],
    uniqueBy: ["slug", "name"],
    uniqueScope: null,
  },
  subject: {
    kind: "subject",
    label: "Subject",
    parents: [{ field: "category", kind: "category", required: true }],
    uniqueBy: ["slug", "name"],
    uniqueScope: "category",
  },
  chapter: {
    kind: "chapter",
    label: "Chapter",
    parents: [
      { field: "category", kind: "category", required: true },
      { field: "subject", kind: "subject", required: true, mustMatch: ["category"] },
    ],
    uniqueBy: ["slug"],
    uniqueScope: "subject",
  },
  topic: {
    kind: "topic",
    label: "Topic",
    parents: [
      { field: "category", kind: "category", required: true },
      { field: "subject", kind: "subject", required: true, mustMatch: ["category"] },
      { field: "chapter", kind: "chapter", required: true, mustMatch: ["category", "subject"] },
    ],
    uniqueBy: ["slug"],
    uniqueScope: "chapter",
  },
  board: {
    kind: "board",
    label: "Board",
    parents: [],
    uniqueBy: ["slug", "name"],
    uniqueScope: null,
  },
  exam: {
    kind: "exam",
    label: "Exam",
    parents: [
      { field: "category", kind: "category", required: false },
      { field: "board", kind: "board", required: false },
    ],
    uniqueBy: ["slug"],
    uniqueScope: null,
  },
};

type Payload = Record<string, unknown>;

function readId(payload: Payload, field: string): string | null {
  const value = payload[field];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Verifies that every referenced parent exists AND that the submitted hierarchy
 * is internally consistent.
 */
export async function validateHierarchy(
  config: ResourceConfig,
  payload: Payload,
): Promise<void> {
  const issues: { path: string; message: string }[] = [];

  for (const rule of config.parents) {
    const id = readId(payload, rule.field);

    if (!id) {
      if (rule.required) {
        issues.push({ path: rule.field, message: `${rule.field} is required.` });
      }
      continue;
    }

    const parent = await taxonomyRepository.findById(rule.kind, id);

    if (!parent) {
      issues.push({ path: rule.field, message: `The selected ${rule.field} does not exist.` });
      continue;
    }

    for (const matchField of rule.mustMatch ?? []) {
      const expected = readId(payload, matchField);
      const actual = parent[matchField];

      if (expected && actual && actual.toString() !== expected) {
        issues.push({
          path: rule.field,
          message: `The selected ${rule.field} does not belong to the selected ${matchField}.`,
        });
      }
    }
  }

  if (issues.length > 0) {
    throw new ValidationError("The selected hierarchy is inconsistent.", issues);
  }
}

async function assertUnique(
  config: ResourceConfig,
  payload: Payload,
  excludeId?: string,
): Promise<void> {
  for (const field of config.uniqueBy) {
    const value = payload[field];
    if (typeof value !== "string" || value.length === 0) continue;

    const filter: FilterQuery<TaxonomyDoc> = { [field]: value };

    if (config.uniqueScope) {
      const scopeId = readId(payload, config.uniqueScope);
      if (scopeId) filter[config.uniqueScope] = new Types.ObjectId(scopeId);
    }

    if (excludeId) filter._id = { $ne: new Types.ObjectId(excludeId) };

    const existing = await taxonomyRepository.findOne(config.kind, filter);
    if (existing) {
      throw new ConflictError(`A ${config.label.toLowerCase()} with this ${field} already exists.`, [
        { path: field, message: "Must be unique." },
      ]);
    }
  }
}

function buildListFilter(query: TaxonomyListQuery): FilterQuery<TaxonomyDoc> {
  const filter: FilterQuery<TaxonomyDoc> = {};

  if (!query.includeInactive) filter.isActive = true;
  if (query.category) filter.category = new Types.ObjectId(query.category);
  if (query.subject) filter.subject = new Types.ObjectId(query.subject);
  if (query.chapter) filter.chapter = new Types.ObjectId(query.chapter);
  if (query.board) filter.board = new Types.ObjectId(query.board);

  if (query.search) {
    // Escaped, prefix-anchored and length-capped by the schema. The previous
    // project interpolated raw user input into `new RegExp(...)`.
    filter.name = { $regex: `^${escapeRegExp(query.search)}`, $options: "i" };
  }

  return filter;
}

export const taxonomyService = {
  async list(
    kind: TaxonomyKind,
    query: TaxonomyListQuery,
  ): Promise<{ items: TaxonomyDoc[]; total: number }> {
    return taxonomyRepository.list(kind, {
      filter: buildListFilter(query),
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
    });
  },

  async getById(kind: TaxonomyKind, id: string): Promise<TaxonomyDoc> {
    const doc = await taxonomyRepository.findById(kind, id);
    if (!doc) throw new NotFoundError(TAXONOMY_RESOURCES[kind].label);
    return doc;
  },

  async create(
    kind: TaxonomyKind,
    actor: AuthContext,
    payload: Payload,
    context?: AuditContext,
  ): Promise<TaxonomyDoc> {
    assertPermission(actor, "taxonomy:create");

    const config = TAXONOMY_RESOURCES[kind];
    await validateHierarchy(config, payload);
    await assertUnique(config, payload);

    const created = await taxonomyRepository.create(kind, {
      ...payload,
      createdBy: actor.objectId,
    });

    if (context) {
      await auditService.record(
        {
          action: "taxonomy.create",
          resourceType: "taxonomy",
          resourceId: created._id.toString(),
          metadata: { kind, slug: created.slug },
        },
        context,
      );
    }

    return created;
  },

  async update(
    kind: TaxonomyKind,
    actor: AuthContext,
    id: string,
    payload: Payload,
    context?: AuditContext,
  ): Promise<TaxonomyDoc> {
    assertPermission(actor, "taxonomy:update");

    const config = TAXONOMY_RESOURCES[kind];
    const existing = await taxonomyRepository.findById(kind, id);
    if (!existing) throw new NotFoundError(config.label);

    // Merge so hierarchy rules see the resulting document, not just the diff.
    const merged: Payload = {
      category: existing.category?.toString(),
      subject: existing.subject?.toString(),
      chapter: existing.chapter?.toString(),
      board: existing.board?.toString(),
      slug: existing.slug,
      name: existing.name,
      ...payload,
    };

    await validateHierarchy(config, merged);
    await assertUnique(config, merged, id);

    const updated = await taxonomyRepository.updateById(kind, id, payload);
    if (!updated) throw new NotFoundError(config.label);

    if (context) {
      await auditService.record(
        {
          action: "taxonomy.update",
          resourceType: "taxonomy",
          resourceId: id,
          metadata: { kind },
        },
        context,
      );
    }

    return updated;
  },

  async deactivate(
    kind: TaxonomyKind,
    actor: AuthContext,
    id: string,
    context?: AuditContext,
  ): Promise<void> {
    assertPermission(actor, "taxonomy:delete");

    const existing = await taxonomyRepository.findById(kind, id);
    if (!existing) throw new NotFoundError(TAXONOMY_RESOURCES[kind].label);

    await taxonomyRepository.deactivateById(kind, id);

    if (context) {
      await auditService.record(
        {
          action: "taxonomy.delete",
          resourceType: "taxonomy",
          resourceId: id,
          metadata: { kind },
        },
        context,
      );
    }
  },
};

export type TaxonomyService = typeof taxonomyService;
