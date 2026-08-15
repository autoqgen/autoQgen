import type { Metadata } from "next";

import TaxonomyManager, { type TaxonomyField } from "@/components/dashboard/TaxonomyManager";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Boards" };
export const dynamic = "force-dynamic";

const FIELDS: TaxonomyField[] = [
  { key: "name", label: "Name", type: "text", required: true },
  { key: "slug", label: "Slug", type: "text", required: true },
  { key: "shortName", label: "Short name", type: "text" },
  { key: "country", label: "Country", type: "text" },
];

export default async function Page() {
  const user = await requireAuth();

  return (
    <TaxonomyManager
      title="Boards"
      description="Education boards used to tag past-paper questions."
      endpoint="/api/boards"
      fields={FIELDS}
      canWrite={can(user.role, "taxonomy:create")}
    />
  );
}
