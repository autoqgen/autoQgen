import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BookMarked,
  BookOpen,
  Building2,
  ClipboardCheck,
  FilePenLine,
  FileText,
  FolderTree,
  Library,
  Mail,
  Settings,
  Sparkles,
  Tags,
  UserRound,
  Users2,
  type LucideIcon,
} from "lucide-react";

import { Badge, Card } from "@/components/ui";
import { requireAuth } from "@/lib/auth/session";
import { resolveCurrentOrganizationId } from "@/lib/auth/org-session";
import { getDashboardStats } from "@/lib/services/dashboard.service";
import { OrganizationInvitation } from "@/models";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireAuth();
  const currentOrgId = await resolveCurrentOrganizationId(user);

  if (!currentOrgId && user.role !== "super_admin") {
    const pendingInvitesCount = await OrganizationInvitation.countDocuments({
      email: user.email.toLowerCase(),
      status: "pending",
    });

    return (
      <div className="flex flex-col gap-8">
        <header>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Welcome back, {user.name.split(" ")[0]}
            </h1>
            <Badge tone="brand">Member</Badge>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            You are currently signed in with a personal account not linked to an organization.
          </p>
        </header>

        {pendingInvitesCount > 0 ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Mail className="h-6 w-6 text-brand-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-brand-900">
                  You have {pendingInvitesCount} pending organization invitation{pendingInvitesCount > 1 ? "s" : ""}!
                </h2>
                <p className="text-sm text-brand-700 mt-0.5">
                  An organization has invited you to join their team. Review and accept your invitation to get started.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/organization"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 shrink-0"
            >
              Review Invitations <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Building2 className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-amber-900">No Organization Linked</h2>
                <p className="text-sm text-amber-800 mt-0.5">
                  Question bank authoring, AI generation, and paper building tools belong to organizations.
                  Join an organization or accept an invitation to collaborate.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/organization"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-50 shrink-0"
            >
              My Organization <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        <section aria-label="Quick Actions" className="grid gap-4 sm:grid-cols-2">
          <Link href="/dashboard/organization" className="block group">
            <Card className="p-6 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-brand-300 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-lg bg-brand-50 flex items-center justify-center text-brand-600">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-brand-600 uppercase tracking-wider">
                    Governance
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                  My Organization
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Manage memberships, view and accept pending invitations, or inspect current organization status.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-sm font-medium text-brand-600">
                Go to Organization <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>

          <Link href="/dashboard/settings" className="block group">
            <Card className="p-6 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-brand-300 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <Settings className="h-5 w-5" />
                  </div>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Preferences
                  </span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                  Profile & Settings
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Update your personal details, profile credentials, password, and security preferences.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-1.5 text-sm font-medium text-slate-600 group-hover:text-brand-600 transition-colors">
                Open Settings <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </div>
            </Card>
          </Link>
        </section>

        <section aria-label="Organization capabilities" className="mt-2">
          <h2 className="text-base font-semibold text-slate-900 mb-3">
            What unlocks when you join an organization?
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="p-5">
              <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Question Bank</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Access curated questions across 10 formats, taxonomy tags, and multiple difficulty levels.
              </p>
            </Card>

            <Card className="p-5">
              <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center mb-3">
                <Sparkles className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">AI Generation</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Create new curriculum-aligned questions automatically with advanced AI prompt workflows.
              </p>
            </Card>

            <Card className="p-5">
              <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                <Library className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Paper Builder</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Build and export print-ready PDF exam papers complete with custom templates and answer keys.
              </p>
            </Card>

            <Card className="p-5">
              <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
                <Users2 className="h-5 w-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm">Team Workflows</h3>
              <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                Work alongside teachers, content writers, and reviewers with structured approval queues.
              </p>
            </Card>
          </div>
        </section>
      </div>
    );
  }

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
