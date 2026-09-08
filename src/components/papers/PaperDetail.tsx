"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Alert, Badge, Button, Card, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import PaperSidebar from "@/components/papers/PaperSidebar";
import PaperPreview from "@/components/papers/PaperPreview";
import type { GenerationView } from "@/components/papers/GenerateTab";
import type { DesignView, PaperDesignConfig } from "@/components/papers/DesignTab";

/**
 * Paper preview, lifecycle controls and export.
 *
 * Export is a plain link-triggered download rather than a fetch, so the browser
 * handles the binary stream and the Content-Disposition filename. The teacher
 * variant is only offered when the server-side permission allows it — and the
 * export route refuses it regardless if the flag is tampered with.
 */

export interface PaperDetailQuestion {
  number: number;
  text: string;
  marks: number;
  type: string;
  difficulty: string | null;
  options: { label: string; text: string }[];
  answer: string | null;
}

export interface PaperDetailData {
  id: string;
  title: string;
  instructions: string;
  status: string;
  mode: string;
  version: number;
  totalMarks: number;
  totalQuestions: number;
  durationMinutes: number | null;
  meta: { label: string; value: string }[];
  questions: PaperDetailQuestion[];
  history: { version: number; summary: string; changedAt: string }[];
}

interface Props {
  paper: PaperDetailData;
  canPublish: boolean;
  canExportAnswers: boolean;
  canEdit: boolean;
  generation: GenerationView | null;
  design: DesignView;
}

const sameDesign = (a: PaperDesignConfig, b: PaperDesignConfig) => JSON.stringify(a) === JSON.stringify(b);

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "green",
  DRAFT: "slate",
  ARCHIVED: "amber",
};

export default function PaperDetail({
  paper,
  canPublish,
  canExportAnswers,
  canEdit,
  generation,
  design: designView,
}: Props) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);

  // Live design state: the sidebar edits `design`, the preview renders it, and
  // "Save Design" / "Reset Changes" reconcile it against `savedDesign` (what the
  // server currently has). None of this touches the paper's questions.
  const [design, setDesign] = useState<PaperDesignConfig>(designView.config);
  const [savedDesign, setSavedDesign] = useState<PaperDesignConfig>(designView.config);
  const designDirty = useMemo(() => !sameDesign(design, savedDesign), [design, savedDesign]);
  const designController = useMemo(
    () => ({
      value: design,
      onChange: setDesign,
      dirty: designDirty,
      onReset: () => setDesign(savedDesign),
      onSaved: () => setSavedDesign(design),
    }),
    [design, savedDesign, designDirty],
  );

  async function act(action: "publish" | "archive" | "restore" | "clone") {
    setBusy(true);
    setError("");
    setNotice("");

    const result = await apiFetch<{ _id?: string }>(`/api/papers/${paper.id}/actions`, {
      method: "POST",
      json: { action },
    });

    setBusy(false);

    if (!result.success) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    if (action === "clone" && result.data?._id) {
      toast.success("Paper cloned successfully!");
      toast.flash("Paper cloned successfully!", { type: "success" });
      router.push(`/dashboard/papers/${result.data._id}`);
      return;
    }

    const msg = `Paper ${action}d successfully.`;
    setNotice(msg);
    toast.success(msg);
    router.refresh();
  }

  const hasAnswers = paper.questions.some((question) => question.answer);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={STATUS_TONE[paper.status] ?? "slate"}>{paper.status}</Badge>
            <Badge tone="brand">{paper.mode}</Badge>
            <Badge>v{paper.version}</Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{paper.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {paper.totalQuestions} question(s) · {paper.totalMarks} mark(s)
            {paper.durationMinutes ? ` · ${paper.durationMinutes} minutes` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/papers/${paper.id}/export?format=pdf&variant=student`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            PDF (student)
          </a>
          <a
            href={`/api/papers/${paper.id}/export?format=docx&variant=student`}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            DOCX (student)
          </a>
          {canExportAnswers ? (
            <>
              <a
                href={`/api/papers/${paper.id}/export?format=pdf&variant=teacher`}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                PDF (teacher)
              </a>
              <a
                href={`/api/papers/${paper.id}/export?format=docx&variant=teacher`}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                DOCX (teacher)
              </a>
            </>
          ) : null}
        </div>
      </header>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        <div className="flex flex-wrap gap-2">
          {canPublish && paper.status === "DRAFT" ? (
            <Button loading={busy} onClick={() => act("publish")}>
              Publish
            </Button>
          ) : null}
          {canEdit && paper.status !== "ARCHIVED" ? (
            <Button variant="secondary" loading={busy} onClick={() => act("archive")}>
              Archive
            </Button>
          ) : null}
          {canEdit && paper.status === "ARCHIVED" ? (
            <Button variant="secondary" loading={busy} onClick={() => act("restore")}>
              Restore to draft
            </Button>
          ) : null}
          <Button variant="secondary" loading={busy} onClick={() => act("clone")}>
            Clone
          </Button>
          {hasAnswers ? (
            <Button variant="ghost" onClick={() => setShowAnswers((previous) => !previous)}>
              {showAnswers ? "Hide answers" : "Show answers"}
            </Button>
          ) : null}
        </div>
      </Card>

      <PaperPreview design={design} paper={paper} showAnswers={showAnswers} />

      {paper.history.length > 0 ? (
        <Card>
          <h2 className="text-sm font-semibold text-slate-800">Version history</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {[...paper.history].reverse().map((entry) => (
              <li key={entry.version} className="flex items-center gap-3 text-sm">
                <Badge>v{entry.version}</Badge>
                <span className="text-slate-700">{entry.summary}</span>
                <span className="ml-auto text-xs text-slate-400">
                  {new Date(entry.changedAt).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>

    <aside className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <PaperSidebar generation={generation} design={designView} designController={designController} />
    </aside>
    </div>
  );
}
