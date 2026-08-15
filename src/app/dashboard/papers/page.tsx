import type { Metadata } from "next";

import PaperList from "@/components/papers/PaperList";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "Question papers" };
export const dynamic = "force-dynamic";

export default async function PapersPage() {
  const user = await requireAuth();

  return (
    <PaperList
      canPublish={can(user.role, "paper:publish")}
      canCreate={can(user.role, "paper:create")}
    />
  );
}
