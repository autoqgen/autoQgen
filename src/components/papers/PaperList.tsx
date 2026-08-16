"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Pagination,
  Select,
  Spinner,
  TextInput,
} from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import type { PaginationMeta } from "@/types/api";

interface PaperSummary {
  _id: string;
  title: string;
  status: string;
  mode: string;
  totalMarks: number;
  totalQuestions: number;
  version: number;
  updatedAt: string;
  subject?: { name?: string } | null;
}

const STATUS_TONE: Record<string, string> = {
  PUBLISHED: "green",
  DRAFT: "slate",
  ARCHIVED: "amber",
};

interface Props {
  canPublish: boolean;
  canCreate: boolean;
}

export default function PaperList({ canPublish, canCreate }: Props) {
  const [items, setItems] = useState<PaperSummary[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (status) params.set("status", status);
    if (search.trim()) params.set("search", search.trim());
    if (mine) params.set("mine", "true");

    const result = await apiFetch<PaperSummary[]>(`/api/papers?${params.toString()}`);

    setLoading(false);

    if (!result.success) {
      setError(result.error.message);
      setItems([]);
      return;
    }

    setItems(result.data);
    setMeta(result.meta ?? null);
  }, [page, status, search, mine]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function act(id: string, action: "publish" | "archive" | "restore" | "clone") {
    setBusyId(id);
    setError("");
    setNotice("");

    const result = await apiFetch(`/api/papers/${id}/actions`, {
      method: "POST",
      json: { action },
    });

    setBusyId(null);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    const messages = {
      publish: "Paper published.",
      archive: "Paper archived.",
      restore: "Paper restored to draft.",
      clone: "Paper cloned as a new draft.",
    };

    setNotice(messages[action]);
    await load();
  }

  async function remove(id: string) {
    setBusyId(id);
    const result = await apiFetch(`/api/papers/${id}`, { method: "DELETE" });
    setBusyId(null);

    if (!result.success) {
      setError(result.error.message);
      return;
    }

    setNotice("Paper deleted.");
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Question papers</h1>
          <p className="mt-1 text-sm text-slate-500">
            Build papers by hand or generate them from the approved question bank.
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/dashboard/papers/new"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            New paper
          </Link>
        ) : null}
      </header>

      <Card>
        <form
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            void load();
          }}
        >
          <Field label="Search title">
            {({ id }) => (
              <TextInput id={id} value={search} onChange={(event) => setSearch(event.target.value)} />
            )}
          </Field>

          <Field label="Status">
            {({ id }) => (
              <Select
                id={id}
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All</option>
                <option value="DRAFT">Draft</option>
                <option value="PUBLISHED">Published</option>
                <option value="ARCHIVED">Archived</option>
              </Select>
            )}
          </Field>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={mine}
                onChange={(event) => {
                  setMine(event.target.checked);
                  setPage(1);
                }}
              />
              Only mine
            </label>
          </div>

          <div className="flex items-end">
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </Card>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <Card>
        {loading ? (
          <Spinner label="Loading papers" />
        ) : items.length === 0 ? (
          <EmptyState
            title="No papers yet"
            body={canCreate ? "Create your first paper to get started." : "No papers are available to you."}
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {items.map((paper) => (
              <li key={paper._id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={STATUS_TONE[paper.status] ?? "slate"}>{paper.status}</Badge>
                  <Badge tone="brand">{paper.mode}</Badge>
                  <Badge>v{paper.version}</Badge>
                  {paper.subject?.name ? <Badge tone="slate">{paper.subject.name}</Badge> : null}
                </div>

                <Link
                  href={`/dashboard/papers/${paper._id}`}
                  className="mt-2 block text-base font-medium text-slate-900 hover:text-brand-700"
                >
                  {paper.title}
                </Link>

                <p className="mt-1 text-xs text-slate-500">
                  {paper.totalQuestions} question(s) · {paper.totalMarks} mark(s) · updated{" "}
                  {new Date(paper.updatedAt).toLocaleDateString()}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/dashboard/papers/${paper._id}`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </Link>

                  {canCreate ? (
                    <Button
                      variant="secondary"
                      loading={busyId === paper._id}
                      onClick={() => act(paper._id, "clone")}
                    >
                      Clone
                    </Button>
                  ) : null}

                  {canPublish && paper.status === "DRAFT" ? (
                    <Button loading={busyId === paper._id} onClick={() => act(paper._id, "publish")}>
                      Publish
                    </Button>
                  ) : null}

                  {paper.status !== "ARCHIVED" ? (
                    <Button
                      variant="secondary"
                      loading={busyId === paper._id}
                      onClick={() => act(paper._id, "archive")}
                    >
                      Archive
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      loading={busyId === paper._id}
                      onClick={() => act(paper._id, "restore")}
                    >
                      Restore
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    loading={busyId === paper._id}
                    onClick={() => remove(paper._id)}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {meta ? (
          <div className="mt-6">
            <Pagination
              page={meta.page}
              totalPages={meta.totalPages}
              total={meta.total}
              onChange={setPage}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
