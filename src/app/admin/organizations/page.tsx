import { OrganizationsTable } from "@/components/admin/OrganizationsTable";
import { can } from "@/lib/auth/rbac";
import { getOptionalUser } from "@/lib/auth/session";

/**
 * The shared /admin layout only checks user:read:any / user:manage-roles /
 * audit:read — a global team_admin/moderator can pass that gate but must not
 * see platform-wide organization management, which requires the narrower
 * organization:manage permission (super_admin only). Checked again here,
 * same "Access Denied" panel style as the layout's own gate.
 */
export default async function AdminOrganizationsPage() {
  const user = await getOptionalUser();

  if (!user || !can(user.role, "organization:manage")) {
    return (
      <div className="max-w-md mx-auto mt-12 rounded-2xl border border-red-200 bg-white p-8 text-center shadow-lg">
        <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-600">Only Super Admins can manage organizations.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Organizations</h1>
        <p className="mt-1 text-xs text-slate-500">
          Create organizations, assign owners, and review membership across every tenant.
        </p>
      </header>

      <OrganizationsTable />
    </div>
  );
}
