import { Types, type QueryFilter as FilterQuery } from "mongoose";

import { ConflictError, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import { assertPermission, type AuthContext } from "@/lib/auth/session";
import {
  requireContentOrganizationId,
  resolveContentOrganizationId,
} from "@/lib/auth/org-session";
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
  /**
   * When true, this collection is tenant-isolated: every row carries an
   * `organizationId`, and reads/writes/uniqueness are scoped to the caller's
   * current organization. Board and Exam stay global (they model real,
   * shared bodies) and so are false.
   */
  orgScoped: boolean;
}

export const TAXONOMY_RESOURCES: Record<TaxonomyKind, ResourceConfig> = {
  category: {
    kind: "category",
    label: "Category",
    parents: [],
    uniqueBy: ["slug", "name"],
    uniqueScope: null,
    orgScoped: true,
  },
  subject: {
    kind: "subject",
    label: "Subject",
    parents: [{ field: "category", kind: "category", required: true }],
    uniqueBy: ["slug", "name"],
    uniqueScope: "category",
    orgScoped: true,
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
    orgScoped: true,
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
    orgScoped: true,
  },
  board: {
    kind: "board",
    label: "Board",
    parents: [],
    uniqueBy: ["slug", "name"],
    uniqueScope: null,
    orgScoped: false,
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
    orgScoped: false,
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
  organizationId?: string,
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

    // Org-scoped parents are looked up within the same tenant, so a reference
    // to another organization's taxonomy reads as "does not exist".
    const parentScope = TAXONOMY_RESOURCES[rule.kind].orgScoped ? organizationId : undefined;
    const parent = await taxonomyRepository.findById(rule.kind, id, parentScope);

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
  organizationId?: string,
  excludeId?: string,
): Promise<void> {
  for (const field of config.uniqueBy) {
    const value = payload[field];
    if (typeof value !== "string" || value.length === 0) continue;

    const filter: FilterQuery<TaxonomyDoc> = { [field]: value };

    if (config.orgScoped && organizationId) {
      filter.organizationId = new Types.ObjectId(organizationId);
    }

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

function buildListFilter(
  query: TaxonomyListQuery,
  organizationId?: string,
): FilterQuery<TaxonomyDoc> {
  const filter: FilterQuery<TaxonomyDoc> = {};

  if (organizationId) filter.organizationId = new Types.ObjectId(organizationId);
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
    actor: AuthContext,
  ): Promise<{ items: TaxonomyDoc[]; total: number }> {
    const config = TAXONOMY_RESOURCES[kind];

    let organizationId: string | undefined;
    if (config.orgScoped) {
      const resolved = await resolveContentOrganizationId(actor, query.organizationId);
      // No current organization ⇒ nothing to show (the UI renders a
      // "select an organization" empty state).
      if (!resolved) return { items: [], total: 0 };
      organizationId = resolved;
    }

    return taxonomyRepository.list(kind, {
      filter: buildListFilter(query, organizationId),
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
    });
  },

  async getById(kind: TaxonomyKind, id: string, actor: AuthContext): Promise<TaxonomyDoc> {
    const config = TAXONOMY_RESOURCES[kind];
    const organizationId = config.orgScoped
      ? (await resolveContentOrganizationId(actor)) ?? undefined
      : undefined;
    if (config.orgScoped && !organizationId) throw new NotFoundError(config.label);

    const doc = await taxonomyRepository.findById(kind, id, organizationId);
    if (!doc) throw new NotFoundError(config.label);
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
    const organizationId = config.orgScoped
      ? await requireContentOrganizationId(actor, readId(payload, "organizationId"))
      : undefined;

    await validateHierarchy(config, payload, organizationId);
    await assertUnique(config, payload, organizationId);

    const created = await taxonomyRepository.create(kind, {
      ...payload,
      // Server-derived — the resolved tenant always wins over any client value.
      ...(organizationId ? { organizationId: new Types.ObjectId(organizationId) } : {}),
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
    const organizationId = config.orgScoped
      ? await requireContentOrganizationId(actor, readId(payload, "organizationId"))
      : undefined;

    const existing = await taxonomyRepository.findById(kind, id, organizationId);
    if (!existing) throw new NotFoundError(config.label);

    // Merge so hierarchy rules see the resulting document, not just the diff.
    // `organizationId` is never movable between tenants through an update.
    const merged: Payload = {
      category: existing.category?.toString(),
      subject: existing.subject?.toString(),
      chapter: existing.chapter?.toString(),
      board: existing.board?.toString(),
      slug: existing.slug,
      name: existing.name,
      ...payload,
      organizationId,
    };

    await validateHierarchy(config, merged, organizationId);
    await assertUnique(config, merged, organizationId, id);

    const { organizationId: _ignored, ...writablePayload } = payload;
    const updated = await taxonomyRepository.updateById(kind, id, writablePayload);
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

    const config = TAXONOMY_RESOURCES[kind];
    const organizationId = config.orgScoped
      ? await requireContentOrganizationId(actor)
      : undefined;

    const existing = await taxonomyRepository.findById(kind, id, organizationId);
    if (!existing) throw new NotFoundError(config.label);

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
