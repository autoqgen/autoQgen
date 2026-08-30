import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge, Card, EmptyState } from "@/components/ui";
import { OrganizationSwitcher } from "@/components/organization/OrganizationSwitcher";
import { PendingInvitationsList } from "@/components/organization/PendingInvitationsList";
import { canInOrg } from "@/lib/auth/org-rbac";
import { getMembership, resolveCurrentOrganizationId } from "@/lib/auth/org-session";
import { getOptionalUser } from "@/lib/auth/session";
import { organizationRepository } from "@/lib/repositories/organization.repo";
import { organizationMemberService } from "@/lib/services/organization-member.service";

const QUICK_LINKS = [
  { href: "/dashboard/organization/members", label: "Members", permission: "members:read" as const },
  { href: "/dashboard/organization/invitations", label: "Invitations", permission: "invitations:manage" as const },
  { href: "/dashboard/organization/teams", label: "Teams", permission: "teams:read" as const },
  { href: "/dashboard/organization/settings", label: "Settings", permission: "organization:update" as const },
];

export default async function OrganizationOverviewPage() {
  const user = await getOptionalUser();
  if (!user) redirect("/login?callbackUrl=/dashboard/organization");

  const memberships = await organizationMemberService.listMineWithOrganization(user);
  const organizationId = await resolveCurrentOrganizationId(user);

  const [organization, membership] = organizationId
    ? await Promise.all([organizationRepository.findById(organizationId), getMembership(user.objectId, organizationId)])
    : [null, null];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Organization</h1>
          <p className="mt-1 text-xs text-slate-500">Manage your organization membership and governance.</p>
        </div>
        {memberships.length > 1 ? (
          <OrganizationSwitcher memberships={memberships} currentOrganizationId={organizationId} />
        ) : null}
      </header>

      <PendingInvitationsList />

      {!organization || !membership ? (
        <EmptyState
          title="No organizations yet"
          body="You're not a member of any organization. Accept a pending invitation above, or ask an administrator to invite you."
        />
      ) : (
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-slate-900">{organization.name}</h2>
            <Badge tone="brand">{membership.role.replace(/_/g, " ")}</Badge>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {QUICK_LINKS.filter((link) => canInOrg(membership.role, link.permission)).map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg border border-slate-200 px-3 py-2 font-medium text-slate-700 hover:bg-slate-50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
