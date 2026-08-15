import type { Metadata } from "next";

import TaxonomyManager, { type TaxonomyField } from "@/components/dashboard/TaxonomyManager";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Exams" };
export const dynamic = "force-dynamic";

const FIELDS: TaxonomyField[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "slug", label: "Slug", type: "text", required: true },
  { key: "board", label: "Board", type: "parent", source: "/api/boards" },
  { key: "category", label: "Category", type: "parent", source: "/api/categories" },
  { key: "year", label: "Year", type: "number" },
  { key: "session", label: "Session", type: "text" },
];

export default async function Page() {
  const user = await requireAuth();

  return (
    <TaxonomyManager
      title="Exams"
      description="Exam sittings, optionally scoped to a board and year."
      endpoint="/api/exams"
      fields={FIELDS}
      canWrite={can(user.role, "taxonomy:create")}
    />
  );
}
