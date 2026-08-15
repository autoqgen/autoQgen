import type { Metadata } from "next";
import { redirect } from "next/navigation";

import PaperBuilder from "@/components/papers/PaperBuilder";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export const metadata: Metadata = { title: "New paper" };
export const dynamic = "force-dynamic";

export default async function NewPaperPage() {
  const user = await requireAuth();
  if (!can(user.role, "paper:create")) redirect("/dashboard/papers");

  return <PaperBuilder />;
}
