import type { Metadata } from "next";
import { redirect } from "next/navigation";

import BulkImport from "@/components/questions/BulkImport";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { taxonomyService } from "@/lib/services/taxonomy.service";

export const metadata: Metadata = { title: "Bulk import" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await requireAuth();

  // Bulk import is admin-tier; the API enforces it too.
  if (!can(user.role, "question:bulk-import")) redirect("/dashboard/questions");

  // Scoped to the caller's current organization (for a super_admin, the one
  // they have selected); an actor with no organization simply sees no
  // categories and cannot start an import.
  const { items } = await taxonomyService.list(
    "category",
    { page: 1, limit: 100, includeInactive: false, search: undefined },
    user,
  );

  return (
    <BulkImport
      categories={items.map((item) => ({ _id: item._id.toString(), name: item.name }))}
    />
  );
}
