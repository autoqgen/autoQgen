import { redirect } from "next/navigation";

import { OrganizationSettingsForm } from "@/components/organization/OrganizationSettingsForm";
import { canInOrg } from "@/lib/auth/org-rbac";
import { requireCurrentOrganizationId, getMembership } from "@/lib/auth/org-session";
import { getOptionalUser } from "@/lib/auth/session";
import { organizationRepository } from "@/lib/repositories/organization.repo";
import { isAppError } from "@/lib/errors/app-error";

export default async function OrganizationSettingsPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?callbackUrl=/dashboard/organization/settings");

  let organizationId: string;
  try {
    organizationId = await requireCurrentOrganizationId(user);
  } catch (error) {
    if (isAppError(error)) {
      return (
        <div className="max-w-md mx-auto mt-12 rounded-2xl border border-red-200 bg-card p-8 text-center shadow-lg">
          <h1 className="text-xl font-bold text-slate-900">No organization selected</h1>
          <p className="mt-2 text-sm text-slate-600">{error.message}</p>
        </div>
      );
    }
    throw error;
  }

  const [organization, membership] = await Promise.all([
    organizationRepository.findById(organizationId),
    getMembership(user.objectId, organizationId),
  ]);

  if (!organization || !membership) {
    return (
      <div className="max-w-md mx-auto mt-12 rounded-2xl border border-red-200 bg-card p-8 text-center shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="mt-1 text-xs text-slate-500">Organization-specific settings, separate from platform settings.</p>
      </header>

      <OrganizationSettingsForm
        organizationName={organization.name}
        organizationSlug={organization.slug}
        canEdit={canInOrg(membership.role, "organization:update")}
      />
    </div>
  );
}
