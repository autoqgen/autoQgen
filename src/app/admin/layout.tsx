import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import AdminSidebar from "@/components/admin/AdminSidebar";
import { canAny } from "@/lib/auth/rbac";
import { getOptionalUser } from "@/lib/auth/session";
import { resolveDisplayRole } from "@/lib/auth/role-display";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getOptionalUser();

  if (!user) {
    redirect("/login?callbackUrl=/admin");
  }

  // Check admin privileges
  const isAuthorized = canAny(user.role, ["user:read:any", "user:manage-roles", "audit:read"]);

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md w-full rounded-2xl border border-red-200 bg-card p-8 text-center shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            🛡️
          </div>
          <h1 className="mt-4 text-xl font-bold text-slate-900">Access Denied</h1>
          <p className="mt-2 text-sm text-slate-600">
            You do not have administrative privileges to view the Admin Center.
          </p>
          <a
            href="/dashboard"
            className="mt-6 inline-flex rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-700"
          >
            Return to Dashboard
          </a>
        </div>
      </div>
    );
  }
  const displayRole = await resolveDisplayRole(user);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row bg-slate-50">
      <AdminSidebar name={user.name} email={user.email} image={user.image ?? undefined} role={user.role} displayRole={displayRole} />
      <main id="main" className="flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
