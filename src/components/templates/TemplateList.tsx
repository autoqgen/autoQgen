"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, LayoutTemplate, Pencil, Plus, Trash2 } from "lucide-react";

import { Alert, Badge, Button, Card, EmptyState, Spinner, TextInput, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";

/**
 * Question Pattern Templates — organization-level reusable paper patterns.
 *
 * Read-only for users who can only *use* templates (they load one from the New
 * Paper builder); create / edit / duplicate / delete appear only with
 * `template:manage` (`canManage`).
 */

interface TaxRef {
  _id: string;
  name: string;
}
interface UserRef {
  name?: string;
  email?: string;
}
interface TemplateItem {
  _id: string;
  name: string;
  description?: string;
  category?: TaxRef | string | null;
  subject?: TaxRef | string | null;
  generationSpec?: Record<string, unknown> | null;
  createdBy?: UserRef | string | null;
  updatedAt: string;
}

const nameOf = (value: unknown): string =>
  value && typeof value === "object" && "name" in value
    ? String((value as { name?: unknown }).name ?? "")
    : "";

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? "" : "s"} ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

/** "20 questions · 50 marks · MCQ 15 · CQ 5" from a stored generation pattern. */
function patternSummary(spec: Record<string, unknown> | null | undefined): string {
  if (!spec) return "No pattern configured";
  const parts: string[] = [];
  const total = Number(spec.totalQuestions);
  if (Number.isFinite(total) && total > 0) parts.push(`${total} question${total === 1 ? "" : "s"}`);
  const marks = spec.totalMarks;
  if (marks != null && marks !== "" && Number.isFinite(Number(marks))) parts.push(`${marks} marks`);
  const types = Array.isArray(spec.typeDistribution) ? spec.typeDistribution : [];
  for (const t of types as { type?: string; count?: number }[]) {
    if (t?.type && t.count) parts.push(`${t.type} ${t.count}`);
  }
  return parts.length ? parts.join(" · ") : "No pattern configured";
}

export default function TemplateList({ canManage }: { canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [items, setItems] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string>("");
  const [confirmId, setConfirmId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    const result = await apiFetch<TemplateItem[]>("/api/question-templates?limit=100");
    setLoading(false);
    if (!result.success) {
      setLoadError(result.error.message);
      return;
    }
    setItems(result.data);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? items.filter((t) => t.name.toLowerCase().includes(q)) : items;
  }, [items, search]);

  async function duplicate(id: string) {
    setBusyId(id);
    const result = await apiFetch<TemplateItem>(`/api/question-templates/${id}/duplicate`, { method: "POST" });
    setBusyId("");
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success(`Template duplicated as "${result.data.name}".`);
    void load();
  }

  async function remove(id: string) {
    setBusyId(id);
    const result = await apiFetch(`/api/question-templates/${id}`, { method: "DELETE" });
    setBusyId("");
    setConfirmId("");
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.info("Template deleted.");
    setItems((prev) => prev.filter((t) => t._id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-slate-900">
            <LayoutTemplate className="h-6 w-6 text-brand-600" />
            Question Pattern Templates
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Reusable question-paper patterns for your organization — a Question Generation Pattern plus a Paper Design.
            Load one when creating a paper, then change anything before generating.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => router.push("/dashboard/templates/new")}>
            <Plus className="h-4 w-4" /> New Template
          </Button>
        ) : null}
      </header>

      <div className="max-w-xs">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          aria-label="Search templates"
        />
      </div>

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}

      {loading ? (
        <Spinner label="Loading templates" />
      ) : shown.length === 0 ? (
        <EmptyState
          title={search ? "No matching templates" : "No templates yet"}
          body={
            search
              ? "Try a different search."
              : canManage
                ? "Create a template to capture a standard paper pattern and reuse it every time."
                : "Templates your organization defines will appear here, ready to load when you create a paper."
          }
          action={
            canManage && !search ? (
              <Button onClick={() => router.push("/dashboard/templates/new")}>
                <Plus className="h-4 w-4" /> New Template
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => {
            const subject = nameOf(t.subject);
            const category = nameOf(t.category);
            const author = nameOf(t.createdBy) || (typeof t.createdBy === "object" ? t.createdBy?.email : "") || "—";
            return (
              <Card key={t._id} className="flex flex-col gap-3">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-sm font-semibold text-slate-900">{t.name}</h2>
                    {subject ? <Badge tone="brand">{subject}</Badge> : null}
                  </div>
                  {t.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">{t.description}</p>
                  ) : null}
                </div>

                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  {category ? (
                    <>
                      <dt className="text-slate-400">Class</dt>
                      <dd className="text-slate-700">{category}</dd>
                    </>
                  ) : null}
                  <dt className="text-slate-400">Pattern</dt>
                  <dd className="text-slate-700">{patternSummary(t.generationSpec)}</dd>
                  <dt className="text-slate-400">Updated</dt>
                  <dd className="text-slate-700">{relativeTime(t.updatedAt)}</dd>
                  <dt className="text-slate-400">By</dt>
                  <dd className="text-slate-700">{author}</dd>
                </dl>

                {canManage ? (
                  confirmId === t._id ? (
                    <div className="mt-auto flex items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                      <span>Delete this template?</span>
                      <span className="flex gap-2">
                        <button
                          type="button"
                          className="font-semibold text-red-700 hover:underline disabled:opacity-50"
                          disabled={busyId === t._id}
                          onClick={() => remove(t._id)}
                        >
                          Delete
                        </button>
                        <button
                          type="button"
                          className="text-slate-500 hover:underline"
                          onClick={() => setConfirmId("")}
                        >
                          Cancel
                        </button>
                      </span>
                    </div>
                  ) : (
                    <div className="mt-auto flex flex-wrap gap-2">
                      <Link
                        href={`/dashboard/templates/${t._id}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Link>
                      <button
                        type="button"
                        disabled={busyId === t._id}
                        onClick={() => duplicate(t._id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5" /> Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmId(t._id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  )
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
