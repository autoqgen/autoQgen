import { notFound } from "next/navigation";

import { Badge, Card } from "@/components/ui";
import { OrganizationMembersTable } from "@/components/organization/OrganizationMembersTable";
import { OrganizationDetailActions } from "@/components/admin/OrganizationDetailActions";
import { can } from "@/lib/auth/rbac";
import { getOptionalUser } from "@/lib/auth/session";
import { organizationService } from "@/lib/services/organization.service";
import { NotFoundError } from "@/lib/errors/app-error";

export default async function AdminOrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getOptionalUser();

  if (!user || !can(user.role, "organization:manage")) {
    return (
      <div className="max-w-md mx-auto mt-12 rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600">Only Super Admins can manage organizations.</p>
      </div>
    );
  }

  let organization;
  try {
    organization = await organizationService.getById(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">{organization.name}</h1>
            <Badge tone={organization.isActive ? "green" : "red"}>
              {organization.isActive ? "active" : "suspended"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">/{organization.slug}</p>
        </div>
        <OrganizationDetailActions
          organizationId={organization.id}
          isActive={organization.isActive}
          hasOwner={Boolean(organization.ownerId)}
        />
      </header>

      <Card className="p-6">
        <dl className="grid gap-4 sm:grid-cols-3 text-sm">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Owner</dt>
            <dd className="mt-1 text-slate-900">
              {organization.ownerName ?? <span className="text-slate-400">Not assigned</span>}
            </dd>
            {organization.ownerEmail ? <dd className="text-xs text-slate-500">{organization.ownerEmail}</dd> : null}
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Members</dt>
            <dd className="mt-1 text-slate-900">{organization.memberCount}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wider text-slate-400">Created</dt>
            <dd className="mt-1 text-slate-900">{new Date(organization.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </Card>

      <div>
        <h2 className="text-sm font-bold text-slate-900 mb-3">Members</h2>
        <OrganizationMembersTable fetchUrl={`/api/admin/organizations/${organization.id}/members`} />
      </div>
    </div>
  );
}
