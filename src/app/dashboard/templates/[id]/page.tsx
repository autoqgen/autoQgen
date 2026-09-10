import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import TemplateForm from "@/components/templates/TemplateForm";
import { requireAuth } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { questionTemplateService } from "@/lib/services/question-template.service";
import { paperDesignSchema } from "@/lib/validation/paper.schema";
import type { PaperDesignConfig } from "@/components/papers/DesignTab";

export const metadata: Metadata = { title: "Edit Question Pattern Template" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const idOf = (value: unknown): string =>
  value && typeof value === "object" && "_id" in value
    ? String((value as { _id: unknown })._id)
    : String(value ?? "");

export default async function EditTemplatePage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuth();
  if (!can(user.role, "template:manage")) redirect("/dashboard/templates");

  const template = await questionTemplateService.getById(id, user).catch(() => null);
  if (!template) notFound();

  // Merge every Paper Design default over whatever the template saved.
  const initialDesign = paperDesignSchema.parse(
    template.designConfig ?? {},
  ) as unknown as PaperDesignConfig;

  return (
    <TemplateForm
      mode="edit"
      templateId={id}
      initial={{
        name: template.name,
        description: template.description ?? "",
        generationSpec: (template.generationSpec ?? {}) as Record<string, unknown>,
        categoryId: template.category ? idOf(template.category) : "",
        subjectId: template.subject ? idOf(template.subject) : "",
      }}
      initialDesign={initialDesign}
    />
  );
}
