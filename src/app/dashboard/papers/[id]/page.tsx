import type { Metadata } from "next";
import { notFound } from "next/navigation";

import PaperDetail, { type PaperDetailData } from "@/components/papers/PaperDetail";
import type { GenerationView } from "@/components/papers/GenerateTab";
import type { DesignView } from "@/components/papers/DesignTab";
import { requireAuth } from "@/lib/auth/session";
import { can, canExportAnswers as roleCanExportAnswers } from "@/lib/auth/rbac";
import { paperService } from "@/lib/services/paper.service";
import { taxonomyRepository } from "@/lib/repositories/taxonomy.repo";
import { organizationRepository } from "@/lib/repositories/organization.repo";
import { buildRenderedPaper } from "@/lib/export/paper-document";
import { DEFAULT_PAPER_DESIGN } from "@/lib/validation/paper.schema";

export const metadata: Metadata = { title: "Paper" };
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

const nameOf = (value: unknown): string =>
  value && typeof value === "object" && "name" in value ? String((value as { name?: unknown }).name ?? "") : "";
const idOf = (value: unknown): string =>
  value && typeof value === "object" && "_id" in value ? String((value as { _id: unknown })._id) : String(value ?? "");

export default async function PaperPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireAuth();

  const withAnswers = roleCanExportAnswers(user.role);

  const paper = await paperService.getById(id, user, { withAnswers }).catch(() => null);
  if (!paper) notFound();

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

  /* ---- Generation Settings sidebar (AUTO papers only) ---- */
  let generation: GenerationView | null = null;
  const spec = paper.generationSpec;
  if (paper.mode === "AUTO" && spec) {
    const orgId = paper.organizationId.toString();
    const chapterIds = (spec.chapters ?? []).map((c) => idOf(c));
    const topicIds = (spec.topics ?? []).map((t) => idOf(t));

    const [org, chapterRefs, topicRefs, history] = await Promise.all([
      organizationRepository.findById(orgId),
      taxonomyRepository.findHierarchyRefs("chapter", chapterIds, orgId),
      taxonomyRepository.findHierarchyRefs("topic", topicIds, orgId),
      paperService.generationHistory(id, user),
    ]);

    generation = {
      paperId: id,
      paperTitle: paper.title,
      description: paper.description ?? "",
      instructions: paper.instructions ?? "",
      durationMinutes: paper.durationMinutes ?? null,
      canRegenerate: canEdit && paper.status !== "ARCHIVED",
      organizationLabel: org?.name ?? "",
      categoryLabel: nameOf(paper.category),
      subjectLabel: nameOf(paper.subject),
      boardLabel: nameOf(paper.board) || null,
      examLabel: nameOf(paper.exam) || null,
      chapters: chapterIds.map((cid) => ({ id: cid, name: chapterRefs.get(cid)?.name ?? "Chapter" })),
      topics: topicIds.map((tid) => ({ id: tid, name: topicRefs.get(tid)?.name ?? "Topic" })),
      spec: {
        category: idOf(spec.category) || idOf(paper.category),
        subject: idOf(spec.subject) || idOf(paper.subject),
        board: spec.board ? idOf(spec.board) : null,
        exam: spec.exam ? idOf(spec.exam) : null,
        year: spec.year ?? null,
        language: spec.language ?? null,
        chapters: chapterIds,
        topics: topicIds,
        totalQuestions: spec.totalQuestions ?? paper.totalQuestions ?? 0,
        totalMarks: spec.totalMarks ?? null,
        difficultyDistribution: (spec.difficultyDistribution ?? []).map((d) => ({
          difficulty: d.difficulty,
          count: d.count,
        })),
        typeDistribution: (spec.typeDistribution ?? []).map((t) => ({ type: t.type, count: t.count })),
        chapterDistribution: (spec.chapterDistribution ?? []).map((c) => ({
          chapter: idOf(c.chapter),
          count: c.count,
        })),
        previousQuestions: {
          mode: spec.previousQuestions?.mode ?? "allow",
          percent: spec.previousQuestions?.percent ?? 100,
          paperRange: spec.previousQuestions?.paperRange ?? 0,
        },
        excludeRecentPapers: spec.excludeRecentPapers ?? 0,
        mandatoryQuestionIds: (spec.mandatoryQuestionIds ?? []).map((q) => idOf(q)),
        excludedQuestionIds: (spec.excludedQuestionIds ?? []).map((q) => idOf(q)),
        randomize: {
          selection: spec.randomize?.selection ?? true,
          order: spec.randomize?.order ?? false,
          options: spec.randomize?.options ?? false,
        },
      },
      history: history.map((h) => ({
        id: h._id.toString(),
        round: h.generationRound ?? 1,
        totalQuestions: h.totalQuestions,
        status: h.status,
        createdAt: new Date(h.createdAt).toISOString(),
        isCurrent: h._id.toString() === id,
      })),
    };
  }

  /* ---- Design sidebar (any paper) ---- */
  const savedDesign = (paper.designConfig ?? {}) as Record<string, Record<string, unknown>>;
  const group = <K extends keyof typeof DEFAULT_PAPER_DESIGN>(key: K) => ({
    ...(DEFAULT_PAPER_DESIGN[key] as Record<string, unknown>),
    ...((savedDesign[key as string] as Record<string, unknown> | undefined) ?? {}),
  });
  const config = {
    template: (savedDesign.template as unknown as string) ?? DEFAULT_PAPER_DESIGN.template,
    output: group("output"),
    header: group("header"),
    studentInfo: group("studentInfo"),
    codes: group("codes"),
    heading: group("heading"),
    layout: group("layout"),
    numbering: group("numbering"),
    font: group("font"),
    paper: group("paper"),
    booklet: group("booklet"),
    advanced: group("advanced"),
  };
  // Sensible display defaults for a paper that has never had Design saved.
  const h = config.header as Record<string, unknown>;
  if (!h.organizationName && generation?.organizationLabel) h.organizationName = generation.organizationLabel;
  if (!h.programName) h.programName = nameOf(paper.exam);
  if (!h.subject) h.subject = nameOf(paper.subject);
  if (!h.className) h.className = nameOf(paper.category);
  if (!h.totalMarks) h.totalMarks = String(paper.totalMarks);
  if (!h.totalTime && paper.durationMinutes) h.totalTime = `${paper.durationMinutes} minutes`;
  if (!h.board) h.board = nameOf(paper.board);
  if (!h.year && paper.year) h.year = String(paper.year);
  if (!h.instructions) h.instructions = paper.instructions ?? "";

  const design: DesignView = {
    paperId: id,
    canSave: canEdit,
    config: config as unknown as DesignView["config"],
  };

  return (
    <PaperDetail
      paper={data}
      canPublish={can(user.role, "paper:publish")}
      canExportAnswers={withAnswers}
      canEdit={canEdit}
      generation={generation}
      design={design}
    />
  );
}
