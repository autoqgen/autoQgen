import type { Metadata } from "next";

import TaxonomyManager, { type TaxonomyField } from "@/components/dashboard/TaxonomyManager";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Subjects" };
export const dynamic = "force-dynamic";

const FIELDS: TaxonomyField[] = [
  { key: "category", label: "Category", type: "parent", required: true, source: "/api/categories" },
  { key: "name", label: "Name", type: "text", required: true },
  { key: "slug", label: "Slug", type: "text", required: true },
  { key: "classLevel", label: "Class level", type: "text" },
  { key: "group", label: "Group", type: "text", hint: "Science, Commerce, Arts." },
];

export default async function Page() {
  const user = await requireAuth();

  return (
    <TaxonomyManager
      title="Subjects"
      description="Subjects belong to a category."
      endpoint="/api/subjects"
      fields={FIELDS}
      canWrite={can(user.role, "taxonomy:create")}
    />
  );
}
