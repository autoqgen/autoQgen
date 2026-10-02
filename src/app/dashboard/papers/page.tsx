import type { Metadata } from "next";

import { redirect } from "next/navigation";
import PaperList from "@/components/papers/PaperList";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hasPermissionOrOrgMembership } from "@/lib/auth/org-session";

export const metadata: Metadata = { title: "Question papers" };
export const dynamic = "force-dynamic";

export default async function PapersPage() {
  const user = await requireAuth();
  const canRead = await hasPermissionOrOrgMembership(user, "paper:read", "paper:read");
  if (!canRead) {
    redirect("/dashboard");
  }
  const canCreate = await hasPermissionOrOrgMembership(user, "paper:create", "paper:create");

  return (
    <PaperList
      canPublish={can(user.role, "paper:publish")}
      canCreate={canCreate}
    />
  );
}
