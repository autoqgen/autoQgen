import type { Metadata } from "next";
import { redirect } from "next/navigation";

import TemplateList from "@/components/templates/TemplateList";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hasPermissionOrOrgMembership } from "@/lib/auth/org-session";

export const metadata: Metadata = { title: "Question Pattern Templates" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await requireAuth();

  // Viewing / loading a template: the global permission, or an active
  // organization membership (a plain `member` gains it that way).
  const canView = await hasPermissionOrOrgMembership(user, "template:read", "template:read");
  if (!canView) redirect("/dashboard");

  return <TemplateList canManage={can(user.role, "template:manage")} />;
}
