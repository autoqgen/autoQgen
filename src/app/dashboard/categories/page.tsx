import type { Metadata } from "next";

import TaxonomyManager, { type TaxonomyField } from "@/components/dashboard/TaxonomyManager";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

const FIELDS: TaxonomyField[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "slug", label: "Slug", type: "text", required: true, hint: "Lowercase, hyphen separated." },
  { key: "order", label: "Order", type: "number" },
];

export default async function Page() {
  const user = await requireAuth();

  return (
    <TaxonomyManager
      title="Categories"
      description="Top level of the taxonomy, for example Class 9-10 or Admission."
      endpoint="/api/categories"
      fields={FIELDS}
      canWrite={can(user.role, "taxonomy:create")}
    />
  );
}
