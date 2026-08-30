import { redirect } from "next/navigation";

import { InvitationsPageClient } from "@/components/organization/InvitationsPageClient";
import { resolveOrgPageAccess } from "@/lib/auth/org-session";
import { getOptionalUser } from "@/lib/auth/session";

export default async function OrganizationInvitationsPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?callbackUrl=/dashboard/organization/invitations");

  const membership = await resolveOrgPageAccess(user, "invitations:manage");
  if (!membership) {
    return (
      <div className="max-w-md mx-auto mt-12 rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600">
          You need an active organization membership with invitation-management access to view this page.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Invitations</h1>
        <p className="mt-1 text-xs text-slate-500">Invite new members to your organization and track their status.</p>
      </header>

      <InvitationsPageClient />
    </div>
  );
}
