"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ShieldAlert } from "lucide-react";

import { Alert, Badge, Button, Card, EmptyState, useToast } from "@/components/ui";
import { apiFetch } from "@/lib/api/client";
import type { SimilarityPairView, SimilarityReviewResult } from "@/lib/services/paper-similarity.service";

/**
 * Semantic Similarity Review — shows ONLY the flagged pairs for one paper.
 *
 * Server-rendered data (`review`); "Keep Both" / "Remove & Replace" call the
 * similarity endpoints and `router.refresh()` so the list always reflects the
 * paper's latest state.
 */

interface Props {
  paperId: string;
  paperTitle: string;
  review: SimilarityReviewResult | null;
  error: string | null;
  canResolve: boolean;
}

export default function SimilarityReview({ paperId, paperTitle, review, error, canResolve }: Props) {
  const router = useRouter();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
      <div>
        <Link
          href={`/dashboard/papers/${paperId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {paperTitle}
        </Link>
        <h1 className="mt-2 flex items-center gap-2 text-2xl font-semibold text-slate-900">
          <ShieldAlert className="h-6 w-6 text-brand-600" />
          Semantic Similarity Review
        </h1>
      </div>

      {error ? (
        <Card>
          <Alert tone="error">{error}</Alert>
          <div className="mt-3">
            <Button variant="secondary" onClick={() => router.refresh()}>
              Try again
            </Button>
          </div>
        </Card>
      ) : review ? (
        <>
          <Card>
            <div className="grid gap-3 sm:grid-cols-3">
              <Summary label="Questions" value={String(review.questionCount)} />
              <Summary label="Similar Pairs" value={String(review.pairs.length)} />
              <Summary label="Threshold" value={`${review.thresholdPercent}%`} />
            </div>
            {review.note ? <p className="mt-3 text-xs text-slate-500">{review.note}</p> : null}
          </Card>

          {review.pairs.length === 0 ? (
            <EmptyState
              title="No Similar Questions"
              body={`No pair of questions in this paper was confirmed as testing the same concept (candidate threshold ${review.thresholdPercent}%).`}
            />
          ) : (
            <div className="flex flex-col gap-4">
              {review.pairs.map((pair) => (
                <PairCard
                  key={`${pair.a.questionId}-${pair.b.questionId}`}
                  paperId={paperId}
                  pair={pair}
                  canResolve={canResolve}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

type PairBusy = null | "keep" | "replace-a" | "replace-b";

function PairCard({
  paperId,
  pair,
  canResolve,
}: {
  paperId: string;
  pair: SimilarityPairView;
  canResolve: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<PairBusy>(null);
  const [failed, setFailed] = useState<{ number: number } | null>(null);

  async function keepBoth() {
    setBusy("keep");
    setFailed(null);
    const result = await apiFetch(`/api/papers/${paperId}/similarities/keep`, {
      method: "POST",
      json: { questionAId: pair.a.questionId, questionBId: pair.b.questionId },
    });
    setBusy(null);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Kept both questions.");
    router.refresh();
  }

  async function replace(side: "a" | "b") {
    const target = side === "a" ? pair.a : pair.b;
    setBusy(side === "a" ? "replace-a" : "replace-b");
    setFailed(null);
    const result = await apiFetch<{
      accepted: boolean;
      replaced?: { scorePercent: number };
    }>(`/api/papers/${paperId}/similarities/replace`, {
      method: "POST",
      json: { questionId: target.questionId },
    });
    setBusy(null);
    if (!result.success) {
      toast.error(result.error.message);
      return;
    }
    if (result.data.accepted) {
      toast.success(
        `Replaced Question ${target.number}${
          result.data.replaced ? ` · ${result.data.replaced.scorePercent}% similar` : ""
        }.`,
      );
      router.refresh();
      return;
    }
    setFailed({ number: target.number });
    toast.error("Unable to find a sufficiently different replacement.");
  }

  const anyBusy = busy !== null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="amber">Potentially Similar</Badge>
        <Badge tone="brand">{pair.scorePercent}% Similar</Badge>
      </div>

      <QuestionBlock q={pair.a} />
      <div className="border-t border-slate-100" />
      <QuestionBlock q={pair.b} />

      {canResolve ? (
        <div className="mt-1 flex flex-wrap gap-2">
          <Button variant="secondary" loading={busy === "keep"} disabled={anyBusy} onClick={keepBoth}>
            Keep Both
          </Button>
          <Button
            variant="secondary"
            loading={busy === "replace-a"}
            disabled={anyBusy}
            onClick={() => replace("a")}
          >
            {busy === "replace-a" ? "Generating replacement…" : `Replace Q${pair.a.number}`}
          </Button>
          <Button
            variant="secondary"
            loading={busy === "replace-b"}
            disabled={anyBusy}
            onClick={() => replace("b")}
          >
            {busy === "replace-b" ? "Generating replacement…" : `Replace Q${pair.b.number}`}
          </Button>
        </div>
      ) : null}

      {failed ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <p className="font-medium">Unable to find a sufficiently different replacement for Question {failed.number}.</p>
          <button
            type="button"
            onClick={() => replace(failed.number === pair.a.number ? "a" : "b")}
            className="mt-1 font-semibold text-amber-800 hover:underline disabled:opacity-50"
            disabled={anyBusy}
          >
            Retry
          </button>
        </div>
      ) : null}
    </Card>
  );
}

function QuestionBlock({ q }: { q: SimilarityPairView["a"] }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-500">
        Question {q.number}
        {q.type ? <span className="ml-2 font-normal text-slate-400">{q.type.replace(/_/g, " ")}</span> : null}
        {q.difficulty ? <span className="ml-1 font-normal text-slate-400">· {q.difficulty}</span> : null}
      </p>
      <p className="mt-1 text-sm text-slate-800">{q.text}</p>
    </div>
  );
}
