import { teamRepository } from "@/lib/repositories/team.repo";
import { organizationMemberRepository } from "@/lib/repositories/organization-member.repo";
import { serializeMember } from "@/lib/services/organization-member.service";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { auditService, type AuditContext } from "@/lib/services/audit.service";
import type { AuthContext } from "@/lib/auth/session";
import type { CreateTeamInput, UpdateTeamInput } from "@/lib/validation/organization.schema";
import type { ITeam } from "@/models";

function serializeTeam(team: ITeam) {
  return {
    id: team._id.toString(),
    organizationId: team.organizationId.toString(),
    name: team.name,
    description: team.description,
    isActive: team.isActive,
    createdAt: team.createdAt.toISOString(),
  };
}

/** Scopes every read/write to a single organization — callers pass an already-authorized organizationId. */
export const teamService = {
  async list(organizationId: string) {
    const teams = await teamRepository.listForOrg(organizationId);
    return teams.map(serializeTeam);
  },

  async create(organizationId: string, input: CreateTeamInput, actor: AuthContext, audit: AuditContext) {
    if (await teamRepository.existsByName(organizationId, input.name)) {
      throw new ConflictError("A team with this name already exists in this organization.");
    }

    const team = await teamRepository.create({
      organizationId,
      name: input.name,
      description: input.description ?? "",
      createdBy: actor.objectId,
    });

    await auditService.record(
      { action: "organization.team.create", resourceType: "team", resourceId: team._id.toString(), metadata: { organizationId, name: team.name } },
      audit,
    );

    return serializeTeam(team);
  },

  async update(organizationId: string, teamId: string, input: UpdateTeamInput, audit: AuditContext) {
    const team = await teamRepository.findById(teamId);
    if (!team || team.organizationId.toString() !== organizationId) {
      throw new NotFoundError("Team");
    }

    if (input.name && input.name !== team.name && (await teamRepository.existsByName(organizationId, input.name))) {
      throw new ConflictError("A team with this name already exists in this organization.");
    }

    const updated = await teamRepository.update(teamId, input);

    await auditService.record(
      { action: "organization.team.update", resourceType: "team", resourceId: teamId, metadata: { organizationId, changes: input } },
      audit,
    );

    return serializeTeam(updated!);
  },

  async remove(organizationId: string, teamId: string, audit: AuditContext) {
    const team = await teamRepository.findById(teamId);
    if (!team || team.organizationId.toString() !== organizationId) {
      throw new NotFoundError("Team");
    }

    await teamRepository.update(teamId, { isActive: false });
    await organizationMemberRepository.clearTeamForMembers(teamId);

    await auditService.record(
      { action: "organization.team.delete", resourceType: "team", resourceId: teamId, metadata: { organizationId } },
      audit,
    );
  },

  /** Assigns an existing org member to this team. Team-scope is checked by the caller (assertTeamPermission). */
  async assignMember(organizationId: string, teamId: string, memberId: string, audit: AuditContext) {
    const team = await teamRepository.findById(teamId);
    if (!team || team.organizationId.toString() !== organizationId) {
      throw new NotFoundError("Team");
    }
    const member = await organizationMemberRepository.findById(memberId);
    if (!member || member.organizationId.toString() !== organizationId) {
      throw new NotFoundError("Member");
    }

    const updated = await organizationMemberRepository.updateFields(memberId, { teamId: team._id });

    await auditService.record(
      { action: "organization.team.update", resourceType: "team", resourceId: teamId, metadata: { organizationId, action: "member-added", memberId } },
      audit,
    );

    return serializeMember(updated!);
  },

  async unassignMember(organizationId: string, teamId: string, memberId: string, audit: AuditContext) {
    const member = await organizationMemberRepository.findById(memberId);
    if (
      !member ||
      member.organizationId.toString() !== organizationId ||
      member.teamId?.toString() !== teamId
    ) {
      throw new NotFoundError("Member");
    }

    const updated = await organizationMemberRepository.updateFields(memberId, { teamId: null });

    await auditService.record(
      { action: "organization.team.update", resourceType: "team", resourceId: teamId, metadata: { organizationId, action: "member-removed", memberId } },
      audit,
    );

    return serializeMember(updated!);
  },
};
