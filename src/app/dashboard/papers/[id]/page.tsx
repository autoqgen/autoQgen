import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PaperDetail, { type PaperDetailData } from "@/components/papers/PaperDetail";
import type { RegenerateSpec } from "@/components/papers/RegeneratePanel";
import { requireAuth } from "@/lib/auth/session";
import { can, canExportAnswers as roleCanExportAnswers } from "@/lib/auth/rbac";
import { paperService } from "@/lib/services/paper.service";
import { buildRenderedPaper } from "@/lib/export/paper-document";

export const metadata: Metadata = { title: "Paper" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PaperPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuth();

  const withAnswers = roleCanExportAnswers(user.role);

  const paper = await paperService.getById(id, user, { withAnswers }).catch(() => null);
  if (!paper) notFound();

  // Reuse the export document model so the on-screen preview and the exported
  // file are built from exactly the same projection.
  const rendered = buildRenderedPaper(paper, withAnswers ? "teacher" : "student");

  const data: PaperDetailData = {
    id,
    title: paper.title,
    instructions: paper.instructions ?? "",
    status: paper.status,
    mode: paper.mode,
    version: paper.version,
    totalMarks: paper.totalMarks,
    totalQuestions: paper.totalQuestions,
    durationMinutes: paper.durationMinutes,
    meta: rendered.meta,
    questions: rendered.sections.flatMap((section) =>
      section.questions.map((question) => ({
        number: question.number,
        text: question.text,
        marks: question.marks,
        type: question.type,
        difficulty: question.difficulty,
        options: question.options,
        answer: question.answer,
      })),
    ),
    history: (paper.versionHistory ?? []).map((entry) => ({
      version: entry.version,
      summary: entry.summary,
      changedAt: new Date(entry.changedAt).toISOString(),
    })),
  };

  const isOwner = paper.createdBy?.toString() === user.id;
  const canEdit = isOwner || can(user.role, "paper:update:any");

  const idOf = (value: unknown): string =>
    typeof value === "object" && value !== null && "_id" in value
      ? String((value as { _id: unknown })._id)
      : String(value);

  const regenerate: RegenerateSpec | null =
    canEdit && paper.mode === "AUTO" && paper.status !== "ARCHIVED"
      ? {
          category: idOf(paper.category),
          subject: idOf(paper.subject),
          board: paper.board ? idOf(paper.board) : null,
          exam: paper.exam ? idOf(paper.exam) : null,
          language: paper.generationSpec?.language ?? null,
          chapters: (paper.generationSpec?.chapters ?? []).map((chapter) => idOf(chapter)),
          totalQuestions: paper.generationSpec?.totalQuestions ?? paper.totalQuestions ?? 10,
          totalMarks: paper.generationSpec?.totalMarks ?? null,
          difficultyDistribution: paper.generationSpec?.difficultyDistribution ?? [],
          typeDistribution: paper.generationSpec?.typeDistribution ?? [],
        }
      : null;

  return (
    <PaperDetail
      paper={data}
      canPublish={can(user.role, "paper:publish")}
      canExportAnswers={withAnswers}
      canEdit={canEdit}
      regenerate={regenerate}
    />
  );
}
