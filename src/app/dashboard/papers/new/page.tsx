import type { Metadata } from "next";
import { redirect } from "next/navigation";

import PaperBuilder from "@/components/papers/PaperBuilder";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hasPermissionOrOrgMembership } from "@/lib/auth/org-session";

export const metadata: Metadata = { title: "New paper" };
export const dynamic = "force-dynamic";

export default async function NewPaperPage() {
  const user = await requireAuth();
  const canCreate = await hasPermissionOrOrgMembership(user, "paper:create", "paper:create");
  if (!canCreate) redirect("/dashboard/papers");

  // Whether to offer "Start from a Template" — viewing/loading needs
  // `template:read` (or an active organization membership for a plain member).
  const templatesEnabled = await hasPermissionOrOrgMembership(user, "template:read", "template:read");

  return (
    <PaperBuilder
      templatesEnabled={templatesEnabled}
      canManageTemplates={can(user.role, "template:manage")}
    />
  );
}
