import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import Sidebar from "@/components/dashboard/Sidebar";
import { getOptionalUser } from "@/lib/auth/session";
import { resolveDisplayRole } from "@/lib/auth/role-display";
import { hasPermissionOrOrgMembership, resolveCurrentOrganizationId } from "@/lib/auth/org-session";
import { OrganizationInvitation } from "@/models";

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

  // Determine authorized navigation links
  const allowedHrefs: string[] = ["/dashboard", "/dashboard/organization", "/dashboard/settings"];

  const [
    canReadPapers,
    canReadQuestions,
    canCreateQuestion,
    canBulkImport,
    canReviewQuestions,
    canGenerateAi,
    canReadTemplates,
    canReadTaxonomy,
  ] = await Promise.all([
    hasPermissionOrOrgMembership(user, "paper:read", "paper:read"),
    hasPermissionOrOrgMembership(user, "question:read", "question:read"),
    hasPermissionOrOrgMembership(user, "question:create", "question:create"),
    hasPermissionOrOrgMembership(user, "question:bulk-import", "question:bulk-import"),
    hasPermissionOrOrgMembership(user, "question:review", "question:review"),
    hasPermissionOrOrgMembership(user, "question:generate-ai", "question:generate-ai"),
    hasPermissionOrOrgMembership(user, "template:read", "template:read"),
    hasPermissionOrOrgMembership(user, "taxonomy:read", "taxonomy:read"),
  ]);

  if (canReadPapers) allowedHrefs.push("/dashboard/papers");
  if (canReadQuestions) allowedHrefs.push("/dashboard/questions");
  if (canCreateQuestion) allowedHrefs.push("/dashboard/questions/new");
  if (canBulkImport) allowedHrefs.push("/dashboard/questions/import");
  if (canReviewQuestions) allowedHrefs.push("/dashboard/review");
  if (canGenerateAi) allowedHrefs.push("/dashboard/questions/ai");
  if (canReadTemplates) allowedHrefs.push("/dashboard/templates");

  if (canReadTaxonomy) {
    allowedHrefs.push(
      "/dashboard/categories",
      "/dashboard/subjects",
      "/dashboard/chapters",
      "/dashboard/topics",
      "/dashboard/boards",
      "/dashboard/exams",
    );
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar
        name={user.name}
        email={user.email}
        image={user.image ?? undefined}
        role={user.role}
        displayRole={displayRole}
        allowedHrefs={allowedHrefs}
      />
      <main id="main" className="flex-1 p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
