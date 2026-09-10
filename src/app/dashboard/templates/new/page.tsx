import type { Metadata } from "next";
import { redirect } from "next/navigation";

import TemplateForm from "@/components/templates/TemplateForm";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { DEFAULT_PAPER_DESIGN } from "@/lib/validation/paper.schema";
import type { PaperDesignConfig } from "@/components/papers/DesignTab";

export const metadata: Metadata = { title: "Create Question Pattern Template" };
export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const user = await requireAuth();
  if (!can(user.role, "template:manage")) redirect("/dashboard/templates");

  return (
    <TemplateForm
      mode="create"
      initialDesign={DEFAULT_PAPER_DESIGN as unknown as PaperDesignConfig}
    />
  );
}
