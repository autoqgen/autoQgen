import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import Sidebar from "@/components/dashboard/Sidebar";
import { getOptionalUser } from "@/lib/auth/session";
import { resolveDisplayRole } from "@/lib/auth/role-display";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Server-side gate.
 *
 * Middleware already redirects unauthenticated requests, and every API handler
 * checks again. This third check exists because the layout renders server data
 * and must never do so for an anonymous or suspended caller.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getOptionalUser();

  if (!user) redirect("/login?callbackUrl=/dashboard");
  const displayRole = await resolveDisplayRole(user);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar name={user.name} email={user.email} image={user.image ?? undefined} role={user.role} displayRole={displayRole} />
      <main id="main" className="flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
