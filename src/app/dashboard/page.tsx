import type { Metadata } from "next";

import { Card } from "@/components/ui";
import { requireAuth } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/services/dashboard.service";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();
  const stats = await getDashboardStats(user);

  const tiles: { label: string; value: number; hint: string }[] = [
    {
      label: "Approved questions",
      value: stats.approvedQuestions,
      hint: "Available across the whole bank",
    },
    { label: "My questions", value: stats.myQuestions, hint: "Created by you" },
    { label: "My drafts", value: stats.myDrafts, hint: "Not yet submitted for review" },
  ];

  if (stats.pendingReview !== null) {
    tiles.push({
      label: "Awaiting review",
      value: stats.pendingReview,
      hint: "Submitted and pending a decision",
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">
          Welcome back, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Every figure below is a live count from your question bank.
        </p>
      </header>

      <section aria-label="Question statistics" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <p className="text-sm text-slate-500">{tile.label}</p>
            <p className="mt-2 text-3xl font-semibold text-slate-900">
              {tile.value.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-slate-400">{tile.hint}</p>
          </Card>
        ))}
      </section>

      <section aria-label="Taxonomy" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Categories", value: stats.categories },
          { label: "Subjects", value: stats.subjects },
          { label: "Chapters", value: stats.chapters },
          { label: "Topics", value: stats.topics },
        ].map((tile) => (
          <Card key={tile.label}>
            <p className="text-sm text-slate-500">{tile.label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {tile.value.toLocaleString()}
            </p>
          </Card>
        ))}
      </section>
    </div>
  );
}
