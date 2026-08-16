import {
  BookOpen,
  Clock,
  FileText,
  HelpCircle,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui";
import { getOptionalUser } from "@/lib/auth/session";

interface AdminStats {
  users: {
    total: number;
    active: number;
    suspended: number;
    byRole: Record<string, number>;
  };
  questions: {
    total: number;
    approved: number;
    pending: number;
  };
  papers: {
    total: number;
    published: number;
  };
  auditLogs: {
    total: number;
  };
}

export default async function AdminOverviewPage() {
  const user = await getOptionalUser();
  if (!user) return null;

  // Internal API call or direct db fetch
  const { Question, QuestionPaper, User, AuditLog } = await import("@/models");
  const { connectDB } = await import("@/lib/db");
  await connectDB();

  const [
    totalUsers,
    activeUsers,
    suspendedUsers,
    totalQuestions,
    approvedQuestions,
    pendingQuestions,
    totalPapers,
    publishedPapers,
    totalAuditLogs,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ status: "active" }),
    User.countDocuments({ status: "suspended" }),
    Question.countDocuments(),
    Question.countDocuments({ status: "APPROVED" }),
    Question.countDocuments({ status: "PENDING" }),
    QuestionPaper.countDocuments(),
    QuestionPaper.countDocuments({ status: "PUBLISHED" }),
    AuditLog.countDocuments(),
  ]);

  const roleCountsRaw = await User.aggregate([
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);

  const byRole: Record<string, number> = {};
  for (const item of roleCountsRaw) {
    if (item._id) byRole[item._id] = item.count;
  }

  const stats: AdminStats = {
    users: {
      total: totalUsers,
      active: activeUsers,
      suspended: suspendedUsers,
      byRole,
    },
    questions: {
      total: totalQuestions,
      approved: approvedQuestions,
      pending: pendingQuestions,
    },
    papers: {
      total: totalPapers,
      published: publishedPapers,
    },
    auditLogs: {
      total: totalAuditLogs,
    },
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand-600">
            <ShieldCheck className="h-4 w-4" />
            <span>Admin Center</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">System Overview</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time platform metrics, user access management, and security governance.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/users"
            className="rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-700 shadow-sm transition"
          >
            Manage Users & Roles
          </Link>
          <Link
            href="/admin/audit"
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm transition"
          >
            View Audit Trail
          </Link>
        </div>
      </header>

      {/* Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/admin/users" className="block group">
          <Card className="p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-blue-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition-colors">
                Total Users
              </span>
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-sm">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              {stats.users.total}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-emerald-600">{stats.users.active} active</span>
              <span>·</span>
              <span className="text-red-500">{stats.users.suspended} suspended</span>
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/questions" className="block group">
          <Card className="p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-emerald-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 group-hover:text-emerald-600 transition-colors">
                Question Bank
              </span>
              <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all shadow-sm">
                <HelpCircle className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
              {stats.questions.total}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-emerald-600">{stats.questions.approved} approved</span>
              <span>·</span>
              <span className="text-amber-600">{stats.questions.pending} pending</span>
            </div>
          </Card>
        </Link>

        <Link href="/dashboard/papers" className="block group">
          <Card className="p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-purple-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 group-hover:text-purple-600 transition-colors">
                Question Papers
              </span>
              <div className="rounded-xl bg-purple-50 p-2.5 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-sm">
                <FileText className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900 group-hover:text-purple-600 transition-colors">
              {stats.papers.total}
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-purple-600">{stats.papers.published} published</span>
            </div>
          </Card>
        </Link>

        <Link href="/admin/audit" className="block group">
          <Card className="p-5 transition-all duration-200 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:border-amber-300">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 group-hover:text-amber-600 transition-colors">
                Audit Events
              </span>
              <div className="rounded-xl bg-amber-50 p-2.5 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-all shadow-sm">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
              {stats.auditLogs.total}
            </p>
            <p className="mt-2 text-xs text-slate-500">Logged security & system actions</p>
          </Card>
        </Link>
      </div>

      {/* Role Breakdown */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-sm font-bold text-slate-900">User Distribution by Role</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Role-based access permissions breakdown across all registered accounts.
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {Object.entries(stats.users.byRole).map(([role, count]) => (
              <div
                key={role}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3 px-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                  <span className="text-xs font-semibold capitalize text-slate-800">
                    {role.replace(/_/g, " ")}
                  </span>
                </div>
                <span className="text-sm font-bold text-slate-900">{count}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Quick Links */}
        <Card className="p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Admin Control Panel</h2>
            <p className="mt-0.5 text-xs text-slate-500">Direct shortcuts to admin features.</p>

            <div className="mt-4 flex flex-col gap-2">
              <Link
                href="/admin/users"
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition text-xs font-medium text-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="h-4 w-4 text-brand-600" />
                  <span>User & Role Governance</span>
                </div>
                <span>→</span>
              </Link>

              <Link
                href="/admin/audit"
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition text-xs font-medium text-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <span>Security Audit Log</span>
                </div>
                <span>→</span>
              </Link>

              <Link
                href="/dashboard/categories"
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition text-xs font-medium text-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <BookOpen className="h-4 w-4 text-purple-600" />
                  <span>Taxonomy Manager</span>
                </div>
                <span>→</span>
              </Link>

              <Link
                href="/admin/settings"
                className="flex items-center justify-between rounded-xl border border-slate-200 p-3 hover:bg-slate-50 transition text-xs font-medium text-slate-800"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="h-4 w-4 text-sky-600" />
                  <span>System Configuration</span>
                </div>
                <span>→</span>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
