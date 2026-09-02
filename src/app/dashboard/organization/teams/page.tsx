import { redirect } from "next/navigation";

import { TeamsManager } from "@/components/organization/TeamsManager";
import { resolveOrgPageAccess } from "@/lib/auth/org-session";
import { getOptionalUser } from "@/lib/auth/session";

export default async function OrganizationTeamsPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?callbackUrl=/dashboard/organization/teams");

  const membership = await resolveOrgPageAccess(user, "teams:read");
  if (!membership) {
    return (
      <div className="max-w-md mx-auto mt-12 rounded-2xl border border-red-200 bg-card p-8 text-center shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          You need an active organization membership with team access to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Teams</h1>
        <p className="mt-1 text-xs text-slate-500">Group members into teams and delegate day-to-day management.</p>
      </header>

      <TeamsManager canCreate={membership.role === "organization_owner"} />
    </div>
  );
}
