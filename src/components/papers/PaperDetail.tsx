"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Alert, Badge, Button, Card, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import { downloadFile } from "@/lib/api/download";
import PaperSidebar from "@/components/papers/PaperSidebar";
import PaperPreview from "@/components/papers/PaperPreview";
import type { GenerationView } from "@/components/papers/GenerateTab";
import type { DesignView, PaperDesignConfig } from "@/components/papers/DesignTab";

/**
 * Paper preview, lifecycle controls and export.
 *
 * Export goes through `downloadFile()` (a `fetch`, not an `<a href>`) so a
 * denied or failed export surfaces as a toast instead of navigating the tab to
 * raw JSON, and `X-Export-Degraded` can be shown as a warning. The teacher
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
  totalMarks: number;
  totalQuestions: number;
  durationMinutes: number | null;
  meta: { label: string; value: string }[];
  questions: PaperDetailQuestion[];
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
  const [exporting, setExporting] = useState<string | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const [simCount, setSimCount] = useState<number | null>(null);

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

  async function runSimilarities() {
    setSimBusy(true);
    setError("");
    const result = await apiFetch<{ pairs: unknown[] }>(`/api/papers/${paper.id}/similarities`, {
      method: "POST",
    });
    setSimBusy(false);
    if (!result.success) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }
    setSimCount(result.data.pairs.length);
    router.push(`/dashboard/papers/${paper.id}/similarities`);
  }

  async function handleExport(format: "pdf" | "docx", variant: "student" | "teacher") {
    const key = `${format}-${variant}`;
    setExporting(key);
    const result = await downloadFile(
      `/api/papers/${paper.id}/export?format=${format}&variant=${variant}`,
      `${paper.title || "question-paper"}-${variant}.${format}`,
    );
    setExporting(null);

    if (!result.ok) {
      toast.error(result.error?.message ?? "Could not export the paper. Please try again.");
      return;
    }
    if (result.degraded) {
      toast.warning(
        "The file downloaded, but some Bangla characters were substituted because a Unicode font was unavailable.",
      );
    }
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
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">{paper.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {paper.totalQuestions} question(s) · {paper.totalMarks} mark(s)
            {paper.durationMinutes ? ` · ${paper.durationMinutes} minutes` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => handleExport("pdf", "student")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting === "pdf-student" ? "Preparing…" : "PDF (student)"}
          </button>
          <button
            type="button"
            disabled={exporting !== null}
            onClick={() => handleExport("docx", "student")}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting === "docx-student" ? "Preparing…" : "DOCX (student)"}
          </button>
          {canExportAnswers ? (
            <>
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => handleExport("pdf", "teacher")}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {exporting === "pdf-teacher" ? "Preparing…" : "PDF (teacher)"}
              </button>
              <button
                type="button"
                disabled={exporting !== null}
                onClick={() => handleExport("docx", "teacher")}
                className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {exporting === "docx-teacher" ? "Preparing…" : "DOCX (teacher)"}
              </button>
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
          {paper.totalQuestions >= 2 ? (
            <Button
              variant="secondary"
              loading={simBusy}
              disabled={busy}
              onClick={runSimilarities}
            >
              {simBusy
                ? "Checking…"
                : simCount && simCount > 0
                  ? `Similarities · ${simCount}`
                  : "Similarities"}
            </Button>
          ) : null}
        </div>
      </Card>

      <PaperPreview design={design} paper={paper} showAnswers={showAnswers} />

    </div>

    <aside className="lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <PaperSidebar generation={generation} design={designView} designController={designController} />
    </aside>
    </div>
  );
}
