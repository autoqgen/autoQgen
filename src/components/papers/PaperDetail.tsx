"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert, Badge, Button, Card, EmptyState } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import RegeneratePanel, { type RegenerateSpec } from "@/components/papers/RegeneratePanel";

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
  regenerate: RegenerateSpec | null;
}

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "green",
  DRAFT: "slate",
  ARCHIVED: "amber",
};

export default function PaperDetail({ paper, canPublish, canExportAnswers, canEdit, regenerate }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showAnswers, setShowAnswers] = useState(false);

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
      return;
    }

    if (action === "clone" && result.data?._id) {
      router.push(`/dashboard/papers/${result.data._id}`);
      return;
    }

    setNotice(`Paper ${action}d.`);
    router.refresh();
  }

  const hasAnswers = paper.questions.some((question) => question.answer);

  return (
    <div className={regenerate ? "grid gap-6 lg:grid-cols-[1fr_320px]" : "flex flex-col gap-6"}>
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

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-6 text-center sm:px-10">
          <p className="text-xs uppercase tracking-widest text-slate-400">Question Paper</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">{paper.title}</h2>

          <dl className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm text-slate-600">
            {paper.meta.map((entry) => (
              <div key={entry.label} className="flex items-center gap-1">
                <dt className="text-slate-400">{entry.label}:</dt>
                <dd className="font-medium text-slate-700">{entry.value}</dd>
              </div>
            ))}
            <div className="flex items-center gap-1">
              <dt className="text-slate-400">Full marks:</dt>
              <dd className="font-medium text-slate-700">{paper.totalMarks}</dd>
            </div>
            {paper.durationMinutes ? (
              <div className="flex items-center gap-1">
                <dt className="text-slate-400">Time:</dt>
                <dd className="font-medium text-slate-700">{paper.durationMinutes} minutes</dd>
              </div>
            ) : null}
          </dl>

          {paper.instructions ? (
            <p className="mx-auto mt-4 max-w-2xl text-sm italic text-slate-600">{paper.instructions}</p>
          ) : null}
        </div>

        <div className="px-6 py-6 sm:px-10">
          {paper.questions.length === 0 ? (
            <EmptyState title="This paper is empty" body="Add questions before publishing it." />
          ) : (
            <ol className="flex flex-col gap-6">
              {paper.questions.map((question) => (
                <li key={question.number} className="flex gap-3">
                  <span className="w-7 shrink-0 text-sm font-semibold text-slate-800">
                    {question.number}.
                  </span>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm leading-relaxed text-slate-900">{question.text}</p>
                      <span className="shrink-0 text-xs font-medium text-slate-500">
                        [{question.marks}]
                      </span>
                    </div>

                    {question.options.length > 0 ? (
                      <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 pl-1 sm:grid-cols-2">
                        {question.options.map((option) => (
                          <p key={option.label} className="text-sm text-slate-700">
                            <span className="text-slate-400">({option.label})</span> {option.text}
                          </p>
                        ))}
                      </div>
                    ) : null}

                    {showAnswers && question.answer ? (
                      <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs text-emerald-900">
                        <span className="font-semibold">Answer: </span>
                        {question.answer}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

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

    {regenerate ? (
      <aside>
        <RegeneratePanel paperId={paper.id} initial={regenerate} />
      </aside>
    ) : null}
    </div>
  );
}
