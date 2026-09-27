"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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
  useToast,
} from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import type { PaginationMeta } from "@/types/api";

/**
 * Review queue.
 *
 * Teachers see their own submissions and their outcomes; reviewers additionally
 * get approve/reject controls. The controls are hidden without the permission
 * and refused server-side regardless — `assertStatusAllowed` in the question
 * service rejects APPROVED/REJECTED from anyone lacking `question:review`.
 */

/** A taxonomy ref is either an id string or a `{ name }` object once populated. */
type TaxonomyRef = string | { _id?: string; name?: string } | null | undefined;

interface QueueQuestion {
  _id: string;
  question: { text: string };
  type: string;
  difficulty: string | null;
  status: string;
  marks: number;
  createdAt: string;
  category?: TaxonomyRef;
  subject?: TaxonomyRef;
  chapter?: TaxonomyRef;
  topic?: TaxonomyRef;
  creativeGroupId?: string;
  creativePartOrder?: number;
  creativePartLabel?: string;
  creativeStimulus?: string;
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "green",
  PENDING: "amber",
  DRAFT: "slate",
  REJECTED: "red",
};

function refName(ref: TaxonomyRef): string {
  return ref && typeof ref === "object" && typeof ref.name === "string" ? ref.name : "";
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

interface Props {
  canReview: boolean;
  /** False when the caller has no current organization — nothing to review. */
  hasOrganization: boolean;
}

export default function ReviewQueue({ canReview, hasOrganization }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<QueueQuestion[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const groups = useMemo(() => {
    const byKey = new Map<string, QueueQuestion[]>();
    for (const item of items) {
      const key = item.creativeGroupId ? `cq:${item.creativeGroupId}` : `q:${item._id}`;
      const group = byKey.get(key) ?? [];
      group.push(item);
      byKey.set(key, group);
    }
    return [...byKey.entries()].map(([key, questions]) => ({
      key,
      questions: questions.sort((a, b) => (a.creativePartOrder ?? 1) - (b.creativePartOrder ?? 1)),
      isCreative: Boolean(questions[0]?.creativeGroupId),
    }));
  }, [items]);

  const load = useCallback(async () => {
    if (!hasOrganization) {
      setItems([]);
      setMeta(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      limit: "100",
      ...(status ? { status } : {}),
    });
    // Without review rights the API only returns your own non-approved work.
    if (!canReview) params.set("mine", "true");

    const result = await apiFetch<QueueQuestion[]>(`/api/questions?${params.toString()}`);

    if (!result.success) {
      setLoading(false);
      setError(result.error.message);
      toast.error(result.error.message);
      setItems([]);
      return;
    }

    let loadedItems = result.data;
    const groupIds = [...new Set(loadedItems.flatMap((item) => item.creativeGroupId ?? []))];
    if (groupIds.length > 0) {
      const groupParams = new URLSearchParams({
        creativeGroupIds: groupIds.join(","),
        limit: "100",
        page: "1",
        ...(canReview ? {} : { mine: "true" }),
      });
      const groupResult = await apiFetch<QueueQuestion[]>(`/api/questions?${groupParams.toString()}`);
      if (!groupResult.success) {
        setLoading(false);
        setError(groupResult.error.message);
        toast.error(groupResult.error.message);
        setItems([]);
        return;
      }
      const groupItems = [...groupResult.data];
      const groupPages = Array.from(
        { length: Math.max(0, (groupResult.meta?.totalPages ?? 1) - 1) },
        (_, index) => {
          const pageParams = new URLSearchParams(groupParams);
          pageParams.set("page", String(index + 2));
          return apiFetch<QueueQuestion[]>(`/api/questions?${pageParams.toString()}`);
        },
      );
      const groupPageResults = await Promise.all(groupPages);
      const failedGroupPage = groupPageResults.find((pageResult) => !pageResult.success);
      if (failedGroupPage && !failedGroupPage.success) {
        setLoading(false);
        setError(failedGroupPage.error.message);
        toast.error(failedGroupPage.error.message);
        setItems([]);
        return;
      }
      for (const pageResult of groupPageResults) {
        if (pageResult.success) groupItems.push(...pageResult.data);
      }
      const normalQuestions = loadedItems.filter((item) => !item.creativeGroupId);
      loadedItems = [...normalQuestions, ...groupItems];
    }
    setLoading(false);
    setItems(loadedItems);
    setMeta(result.meta ?? null);
    setSelected(new Set());
  }, [page, status, canReview, hasOrganization, toast]);

  useEffect(() => {
    queueMicrotask(() => {
      void load();
    });
  }, [load]);

  async function decide(ids: string[], decision: "APPROVED" | "REJECTED" | "PENDING") {
    setWorking(true);
    setNotice("");
    setError("");

    const result =
      decision === "PENDING"
        ? await apiFetch(`/api/questions/${ids[0]}`, {
            method: "PUT",
            json: { status: decision, reviewNote: note },
          })
        : await apiFetch("/api/questions/bulk-review", {
            method: "POST",
            json: { ids, status: decision, reviewNote: note },
          });

    setWorking(false);

    if (!result.success) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    setActiveId(null);
    setNote("");
    const msg =
      decision === "APPROVED"
        ? "Question group approved."
        : decision === "REJECTED"
            ? "Question group rejected and returned to the author."
          : "Question submitted for review.";
    setNotice(msg);
    toast.success(msg);
    await load();
  }

  function toggleSelected(ids: string[]) {
    setSelected((current) => {
      const next = new Set(current);
      if (ids.every((id) => next.has(id))) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  const selectableGroups = groups.filter((group) =>
    group.questions.some((item) => item.status === "DRAFT" || item.status === "PENDING"),
  );
  const selectableIds = selectableGroups.flatMap((group) =>
    group.questions
      .filter((item) => item.status === "DRAFT" || item.status === "PENDING")
      .map((item) => item._id),
  );
  const selectedGroupCount = selectableGroups.filter((group) => {
    const ids = group.questions
      .filter((item) => item.status === "DRAFT" || item.status === "PENDING")
      .map((item) => item._id);
    return ids.length > 0 && ids.every((id) => selected.has(id));
  }).length;
  const allSelectableChosen =
    selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  function toggleSelectAll() {
    setSelected(allSelectableChosen ? new Set() : new Set(selectableIds));
  }

  async function decideBulk(decision: "APPROVED" | "REJECTED") {
    if (selected.size === 0) return;

    setBulkWorking(true);
    setNotice("");
    setError("");

    const result = await apiFetch<{
      requested: number;
      updated: number;
      skipped: { id: string; reason: string }[];
    }>("/api/questions/bulk-review", {
      method: "POST",
      json: { ids: Array.from(selected), status: decision },
    });

    setBulkWorking(false);

    if (!result.success) {
      setError(result.error.message);
      toast.error(result.error.message);
      return;
    }

    const { skipped } = result.data;
    const msg =
      skipped.length === 0
        ? `${selectedGroupCount} question(s) ${decision === "APPROVED" ? "approved" : "rejected"}.`
        : `${selectedGroupCount} question(s) processed; one or more groups were skipped.`;
    setNotice(msg);
    toast.success(msg);
    await load();
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          {canReview ? "Review queue" : "My submissions"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {canReview
            ? "Questions awaiting a decision. Approving makes them eligible for question papers."
            : "Track the review status of questions you have written."}
        </p>
      </header>

      {!hasOrganization ? (
        <Card>
          <EmptyState
            title="No organization selected"
            body={
              canReview
                ? "Select an organization from the switcher to load its review queue. The queue only ever shows the current organization's questions."
                : "Select an organization from the switcher to see the questions you have submitted there."
            }
          />
        </Card>
      ) : (
        <>
      <Card>
        <div className="flex flex-wrap items-end gap-4">
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
                <option value="PENDING">Pending review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </Select>
            )}
          </Field>
          <Button variant="secondary" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </Card>

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      {canReview && selectableIds.length > 0 ? (
        <Card>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={allSelectableChosen}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-slate-300"
              />
              Select all
            </label>
            <span className="text-sm text-slate-500">{selectedGroupCount} selected</span>
            <Button
              loading={bulkWorking}
              disabled={selected.size === 0}
              onClick={() => void decideBulk("APPROVED")}
            >
              Approve selected
            </Button>
            <Button
              variant="danger"
              loading={bulkWorking}
              disabled={selected.size === 0}
              onClick={() => void decideBulk("REJECTED")}
            >
              Reject selected
            </Button>
          </div>
        </Card>
      ) : null}

      <Card>
        {loading ? (
          <Spinner label="Loading queue" />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing to show"
            body={
              canReview
                ? "No questions are waiting for review right now."
                : "You have not submitted any questions with this status."
            }
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {groups.map((group) => {
              const item = group.questions[0]!;
              const ids = group.questions.map((question) => question._id);
              const reviewableIds = group.questions
                .filter((question) => question.status === "DRAFT" || question.status === "PENDING")
                .map((question) => question._id);
              const groupStatus = group.questions.every((question) => question.status === item.status)
                ? item.status
                : "Review needed";
              const groupMarks = group.questions.reduce((sum, question) => sum + question.marks, 0);
              return (
              <li key={group.key} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {canReview && reviewableIds.length > 0 ? (
                    <input
                      type="checkbox"
                      checked={reviewableIds.every((id) => selected.has(id))}
                      onChange={() => toggleSelected(reviewableIds)}
                      className="h-4 w-4 rounded border-slate-300"
                      aria-label={group.isCreative ? "Select complete Creative Question for review" : "Select for review"}
                    />
                  ) : null}
                  <Badge tone="brand">{group.isCreative ? "Creative Question" : item.type.replace(/_/g, " ")}</Badge>
                  {!group.isCreative && item.difficulty ? <Badge>{item.difficulty}</Badge> : null}
                  <Badge tone={STATUS_TONE[item.status] ?? "slate"}>{groupStatus}</Badge>
                  <Badge>{groupMarks} mark(s)</Badge>
                </div>

                {group.isCreative ? (
                  <>
                    <p className="mt-3 text-sm font-medium text-slate-800">উদ্দীপক:</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-800">
                      {item.creativeStimulus ?? "উদ্দীপক অনুপস্থিত"}
                    </p>
                    <ol className="mt-3 flex flex-col gap-1 text-sm text-slate-800">
                      {group.questions.map((question) => (
                        <li key={question._id}>
                          <strong>{question.creativePartLabel ?? ""})</strong> {question.question.text}
                        </li>
                      ))}
                    </ol>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-slate-800">{item.question.text}</p>
                )}

                <dl className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {[
                    ["Category", refName(item.category)],
                    ["Subject", refName(item.subject)],
                    ["Chapter", refName(item.chapter)],
                    ["Topic", refName(item.topic)],
                  ]
                    .filter(([, value]) => value)
                    .map(([label, value]) => (
                      <div key={label} className="flex gap-1">
                        <dt className="font-medium text-slate-400">{label}:</dt>
                        <dd className="text-slate-600">{value}</dd>
                      </div>
                    ))}
                  <div className="flex gap-1">
                    <dt className="font-medium text-slate-400">Created:</dt>
                    <dd className="text-slate-600">{formatDate(item.createdAt)}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/questions/${item._id}/edit`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </Link>

                  {!canReview && group.questions.some((question) => question.status === "DRAFT") ? (
                    <Button
                      variant="secondary"
                      loading={working}
                      onClick={() => decide([item._id], "PENDING")}
                    >
                      Submit for review
                    </Button>
                  ) : null}

                  {canReview && reviewableIds.length > 0 ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setActiveId(activeId === item._id ? null : item._id);
                        setNote("");
                      }}
                    >
                      {activeId === item._id ? "Cancel" : "Review"}
                    </Button>
                  ) : null}
                </div>

                {canReview && activeId === item._id ? (
                  <div className="mt-4 flex flex-col gap-3 rounded-lg bg-slate-50 p-3">
                    <Field label="Review note" hint="Shown to the author. Optional for approval.">
                      {({ id }) => (
                        <TextInput
                          id={id}
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="What should the author change?"
                        />
                      )}
                    </Field>
                    <div className="flex gap-2">
                      <Button loading={working} onClick={() => decide(ids, "APPROVED")}>
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        loading={working}
                        onClick={() => decide(ids, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
              );
            })}
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
        </>
      )}
    </div>
  );
}
