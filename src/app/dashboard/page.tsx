import Link from "next/link";
import type { Metadata } from "next";
import {
  BookMarked,
  BookOpen,
  ClipboardCheck,
  FilePenLine,
  FolderTree,
  Library,
  Tags,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { Card } from "@/components/ui";
import { requireAuth } from "@/lib/auth/session";
import { getDashboardStats } from "@/lib/services/dashboard.service";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();
  const stats = await getDashboardStats(user);

  const tiles: { label: string; value: number; hint: string; href: string; icon: LucideIcon }[] = [
    {
      label: "Organization Questions",
      value: stats.approvedQuestions,
      hint: "Available across your organization",
      href: "/dashboard/questions?status=APPROVED",
      icon: Library,
    },
    {
      label: "My questions",
      value: stats.myQuestions,
      hint: "Created by you",
      href: "/dashboard/questions",
      icon: UserRound,
    },
    {
      label: "My drafts",
      value: stats.myDrafts,
      hint: "Not yet submitted for review",
      href: "/dashboard/questions?status=DRAFT",
      icon: FilePenLine,
    },
  ];

  if (stats.pendingReview !== null) {
    tiles.push({
      label: "Awaiting review",
      value: stats.pendingReview,
      hint: "Submitted and pending a decision",
      href: "/dashboard/review",
      icon: ClipboardCheck,
    });
  }

  const taxonomyTiles = [
    { label: "Categories", value: stats.categories, href: "/dashboard/categories", icon: FolderTree },
    { label: "Subjects", value: stats.subjects, href: "/dashboard/subjects", icon: BookOpen },
    { label: "Chapters", value: stats.chapters, href: "/dashboard/chapters", icon: BookMarked },
    { label: "Topics", value: stats.topics, href: "/dashboard/topics", icon: Tags },
  ];

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
          <Link key={tile.label} href={tile.href} className="block group">
            <Card className="p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-brand-300">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500 group-hover:text-brand-600 transition-colors">
                  {tile.label}
                </p>
                <tile.icon aria-hidden="true" className="h-5 w-5 text-brand-500" />
              </div>
              <p className="mt-2 text-3xl font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                {tile.value.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-slate-400">{tile.hint}</p>
            </Card>
          </Link>
        ))}
      </section>

      <section aria-label="Taxonomy" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {taxonomyTiles.map((tile) => (
          <Link key={tile.label} href={tile.href} className="block group">
            <Card className="p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-brand-300">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500 group-hover:text-brand-600 transition-colors">
                  {tile.label}
                </p>
                <tile.icon aria-hidden="true" className="h-5 w-5 text-brand-500" />
              </div>
              <p className="mt-2 text-2xl font-bold text-slate-900 group-hover:text-brand-600 transition-colors">
                {tile.value.toLocaleString()}
              </p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
