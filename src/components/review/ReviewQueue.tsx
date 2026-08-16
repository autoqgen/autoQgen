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

interface QueueQuestion {
  _id: string;
  question: { text: string };
  type: string;
  difficulty: string | null;
  status: string;
  marks: number;
  createdAt: string;
}

const STATUS_TONE: Record<string, string> = {
  APPROVED: "green",
  PENDING: "amber",
  DRAFT: "slate",
  REJECTED: "red",
};

export default function ReviewQueue({ canReview }: { canReview: boolean }) {
  const toast = useToast();
  const [items, setItems] = useState<QueueQuestion[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState(canReview ? "PENDING" : "");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [activeId, setActiveId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams({
      page: String(page),
      limit: "20",
      ...(status ? { status } : {}),
    });
    // Without review rights the API only returns your own non-approved work.
    if (!canReview) params.set("mine", "true");

    const result = await apiFetch<QueueQuestion[]>(`/api/questions?${params.toString()}`);

    setLoading(false);

    if (!result.success) {
      setError(result.error.message);
      toast.error(result.error.message);
      setItems([]);
      return;
    }

    setItems(result.data);
    setMeta(result.meta ?? null);
    setSelected(new Set());
  }, [page, status, canReview, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(id: string, decision: "APPROVED" | "REJECTED" | "PENDING") {
    setWorking(true);
    setNotice("");
    setError("");

    const result = await apiFetch(`/api/questions/${id}`, {
      method: "PUT",
      json: { status: decision, reviewNote: note },
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
        ? "Question approved."
        : decision === "REJECTED"
          ? "Question rejected and returned to the author."
          : "Question submitted for review.";
    setNotice(msg);
    toast.success(msg);
    await load();
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const selectableIds = items
    .filter((item) => item.status !== "APPROVED")
    .map((item) => item._id);
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

    const { updated, skipped } = result.data;
    const msg =
      skipped.length === 0
        ? `${updated} question(s) ${decision === "APPROVED" ? "approved" : "rejected"}.`
        : `${updated} question(s) ${decision === "APPROVED" ? "approved" : "rejected"}; ${skipped.length} skipped.`;
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
            <span className="text-sm text-slate-500">{selected.size} selected</span>
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
            {items.map((item) => (
              <li key={item._id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {canReview && item.status !== "APPROVED" ? (
                    <input
                      type="checkbox"
                      checked={selected.has(item._id)}
                      onChange={() => toggleSelected(item._id)}
                      className="h-4 w-4 rounded border-slate-300"
                      aria-label="Select for bulk review"
                    />
                  ) : null}
                  <Badge tone="brand">{item.type.replace(/_/g, " ")}</Badge>
                  {item.difficulty ? <Badge>{item.difficulty}</Badge> : null}
                  <Badge tone={STATUS_TONE[item.status] ?? "slate"}>{item.status}</Badge>
                  <Badge>{item.marks} mark(s)</Badge>
                </div>

                <p className="mt-3 text-sm text-slate-800">{item.question.text}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/dashboard/questions/${item._id}/edit`}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Open
                  </Link>

                  {!canReview && item.status === "DRAFT" ? (
                    <Button
                      variant="secondary"
                      loading={working}
                      onClick={() => decide(item._id, "PENDING")}
                    >
                      Submit for review
                    </Button>
                  ) : null}

                  {canReview && item.status !== "APPROVED" ? (
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
                      <Button loading={working} onClick={() => decide(item._id, "APPROVED")}>
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        loading={working}
                        onClick={() => decide(item._id, "REJECTED")}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                ) : null}
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
