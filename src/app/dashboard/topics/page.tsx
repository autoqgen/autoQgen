import type { Metadata } from "next";
import { redirect } from "next/navigation";

import TaxonomyManager, { type TaxonomyField } from "@/components/dashboard/TaxonomyManager";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hasPermissionOrOrgMembership } from "@/lib/auth/org-session";

export const metadata: Metadata = { title: "Topics" };
export const dynamic = "force-dynamic";

const FIELDS: TaxonomyField[] = [
  { key: "category", label: "Category", type: "parent", required: true, source: "/api/categories" },
  { key: "subject", label: "Subject", type: "parent", required: true, source: "/api/subjects", dependsOn: "category" },
  { key: "chapter", label: "Chapter", type: "parent", required: true, source: "/api/chapters", dependsOn: "subject" },
  { key: "name", label: "Name", type: "text", required: true },
  { key: "slug", label: "Slug", type: "text", required: true },
];

export default async function Page() {
  const user = await requireAuth();
  const canRead = await hasPermissionOrOrgMembership(user, "taxonomy:read", "taxonomy:read");
  if (!canRead) redirect("/dashboard");

  return (
    <TaxonomyManager
      title="Topics"
      description="Topics belong to a chapter. The full category to chapter path is validated."
      endpoint="/api/topics"
      fields={FIELDS}
      canWrite={can(user.role, "taxonomy:create")}
    />
  );
}
