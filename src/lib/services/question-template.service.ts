import { Types, type QueryFilter as FilterQuery } from "mongoose";

import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { assertPermission, type AuthContext } from "@/lib/auth/session";
import {
  requireContentOrganizationId,
  resolveContentOrganizationId,
} from "@/lib/auth/org-session";
import { escapeRegExp } from "@/lib/security/regex";
import {
  questionTemplateRepository,
  type TemplateDoc,
} from "@/lib/repositories/question-template.repo";
import { toSkip } from "@/lib/validation/common";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import type {
  CreateQuestionTemplateInput,
  QuestionTemplateListQuery,
  UpdateQuestionTemplateInput,
} from "@/lib/validation/question-template.schema";

/**
 * Question Pattern Template business logic.
 *
 * Mirrors `taxonomy.service.ts`: tenant resolved server-side from the caller's
 * active organization membership, `template:read` gates viewing, `template:manage`
 * gates every mutation. Loading a template into the paper builder never comes
 * back through here, so a user's paper-specific edits can't touch a saved
 * template.
 */

const asObjectId = (value: unknown): Types.ObjectId | null =>
  typeof value === "string" && Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : null;

function buildListFilter(
  query: QuestionTemplateListQuery,
  organizationId: string,
): FilterQuery<TemplateDoc> {
  const filter: FilterQuery<TemplateDoc> = {
    organizationId: new Types.ObjectId(organizationId),
    isActive: true,
  };
  if (query.subject) filter.subject = new Types.ObjectId(query.subject);
  if (query.search) {
    // Escaped, prefix-anchored, length-capped by the schema.
    filter.name = { $regex: `^${escapeRegExp(query.search)}`, $options: "i" };
  }
  return filter;
}

export const questionTemplateService = {
  /**
   * Read authorization (`template:read`, or the org-membership fallback for a
   * plain `member`) is enforced by the caller — the API route via
   * `assertPermissionOrOrgMembership`, the page via `hasPermissionOrOrgMembership`
   * — exactly as `taxonomyService.list` leaves its gate to callers.
   */
  async list(
    query: QuestionTemplateListQuery,
    actor: AuthContext,
  ): Promise<{ items: TemplateDoc[]; total: number }> {
    const organizationId = await resolveContentOrganizationId(actor, query.organizationId);
    if (!organizationId) return { items: [], total: 0 };

    return questionTemplateRepository.list({
      filter: buildListFilter(query, organizationId),
      skip: toSkip(query.page, query.limit),
      limit: query.limit,
      sort: { updatedAt: -1 },
    });
  },

  async getById(id: string, actor: AuthContext, override?: string | null): Promise<TemplateDoc> {
    const organizationId = await resolveContentOrganizationId(actor, override);
    if (!organizationId) throw new NotFoundError("Template");

    const doc = await questionTemplateRepository.findById(id, organizationId);
    if (!doc) throw new NotFoundError("Template");
    return doc;
  },

  async create(
    input: CreateQuestionTemplateInput,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<TemplateDoc> {
    assertPermission(actor, "template:manage");

    const organizationId = await requireContentOrganizationId(actor, input.organizationId);

    if (await questionTemplateRepository.nameTaken(organizationId, input.name)) {
      throw new ConflictError("A template with this name already exists.", [
        { path: "name", message: "Must be unique." },
      ]);
    }

    const created = await questionTemplateRepository.create({
      organizationId: new Types.ObjectId(organizationId),
      name: input.name,
      description: input.description,
      // Denormalised from the pattern for list display / filtering.
      category: asObjectId(input.generationSpec.category),
      subject: asObjectId(input.generationSpec.subject),
      generationSpec: input.generationSpec,
      designConfig: input.designConfig,
      createdBy: actor.objectId,
    });

    await auditService.record(
      {
        action: "template.create",
        resourceType: "question-template",
        resourceId: created._id.toString(),
        metadata: { name: created.name },
      },
      context,
    );

    return created;
  },

  async update(
    id: string,
    input: UpdateQuestionTemplateInput,
    actor: AuthContext,
    context: AuditContext,
  ): Promise<TemplateDoc> {
    assertPermission(actor, "template:manage");

    const organizationId = await requireContentOrganizationId(actor);

    const existing = await questionTemplateRepository.findMetaById(id, organizationId);
    if (!existing || !existing.isActive) throw new NotFoundError("Template");

    if (input.name && input.name !== existing.name) {
      if (await questionTemplateRepository.nameTaken(organizationId, input.name, id)) {
        throw new ConflictError("A template with this name already exists.", [
          { path: "name", message: "Must be unique." },
        ]);
      }
    }

    const patch: Record<string, unknown> = { updatedBy: actor.objectId };
    if (input.name !== undefined) patch.name = input.name;
    if (input.description !== undefined) patch.description = input.description;
    if (input.designConfig !== undefined) patch.designConfig = input.designConfig;
    if (input.generationSpec !== undefined) {
      patch.generationSpec = input.generationSpec;
      patch.category = asObjectId(input.generationSpec.category);
      patch.subject = asObjectId(input.generationSpec.subject);
    }

    const updated = await questionTemplateRepository.updateById(id, patch);
    if (!updated) throw new NotFoundError("Template");

    await auditService.record(
      { action: "template.update", resourceType: "question-template", resourceId: id },
      context,
    );

    return updated;
  },

  async remove(id: string, actor: AuthContext, context: AuditContext): Promise<void> {
    assertPermission(actor, "template:manage");

    const organizationId = await requireContentOrganizationId(actor);
    const existing = await questionTemplateRepository.findMetaById(id, organizationId);
    if (!existing || !existing.isActive) throw new NotFoundError("Template");

    await questionTemplateRepository.softDeleteById(id, actor.objectId);

    await auditService.record(
      { action: "template.delete", resourceType: "question-template", resourceId: id },
      context,
    );
  },

  async duplicate(id: string, actor: AuthContext, context: AuditContext): Promise<TemplateDoc> {
    assertPermission(actor, "template:manage");

    const organizationId = await requireContentOrganizationId(actor);
    const source = await questionTemplateRepository.findById(id, organizationId);
    if (!source) throw new NotFoundError("Template");

    // Find a free "<name> (copy)" / "<name> (copy 2)" … name.
    let name = `${source.name} (copy)`;
    for (let n = 2; await questionTemplateRepository.nameTaken(organizationId, name); n += 1) {
      name = `${source.name} (copy ${n})`;
    }

    const spec = (source.generationSpec ?? {}) as Record<string, unknown>;
    const created = await questionTemplateRepository.create({
      organizationId: new Types.ObjectId(organizationId),
      name,
      description: source.description,
      category: asObjectId(spec.category),
      subject: asObjectId(spec.subject),
      generationSpec: source.generationSpec,
      designConfig: source.designConfig,
      createdBy: actor.objectId,
    });

    await auditService.record(
      {
        action: "template.create",
        resourceType: "question-template",
        resourceId: created._id.toString(),
        metadata: { name: created.name, duplicatedFrom: id },
      },
      context,
    );

    return created;
  },
};

export type QuestionTemplateService = typeof questionTemplateService;
