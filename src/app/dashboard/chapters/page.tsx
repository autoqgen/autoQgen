import type { Metadata } from "next";

import TaxonomyManager, { type TaxonomyField } from "@/components/dashboard/TaxonomyManager";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Chapters" };
export const dynamic = "force-dynamic";

const FIELDS: TaxonomyField[] = [
  { key: "category", label: "Category", type: "parent", required: true, source: "/api/categories" },
  { key: "subject", label: "Subject", type: "parent", required: true, source: "/api/subjects", dependsOn: "category" },
  { key: "name", label: "Name", type: "text", required: true },
  { key: "slug", label: "Slug", type: "text", required: true },
  { key: "chapterNo", label: "Chapter number", type: "number" },
];

export default async function Page() {
  const user = await requireAuth();

  return (
    <TaxonomyManager
      title="Chapters"
      description="Chapters belong to a subject. The subject must sit under the chosen category."
      endpoint="/api/chapters"
      fields={FIELDS}
      canWrite={can(user.role, "taxonomy:create")}
    />
  );
}
