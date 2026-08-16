"use client";

import {
  ArrowLeft,
  BookOpen,
  LayoutDashboard,
  ShieldCheck,
  Sliders,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserProfileDropdown } from "@/components/ui";
import type { UserRole } from "@/types/roles";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users & Roles", icon: Users },
  { href: "/admin/audit", label: "Audit Logs", icon: ShieldCheck },
  { href: "/admin/settings", label: "System Settings", icon: Sliders },
  { href: "/dashboard/categories", label: "Taxonomy", icon: BookOpen },
];

export default function AdminSidebar({
  name,
  email,
  image,
  role,
}: {
  name: string;
  email: string;
  image?: string;
  role: UserRole;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin Navigation"
      className="flex flex-col border-b border-slate-200 bg-white p-4 text-slate-800 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0"
    >
      <div className="flex items-center justify-between shrink-0 pb-4">
        <Link href="/admin" className="flex items-center gap-2 text-lg font-bold text-slate-900">
          <ShieldCheck className="h-6 w-6 text-brand-600" />
          <span>Admin Center</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col gap-4 py-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs shrink-0">
          <p className="text-slate-500 font-medium">Environment</p>
          <div className="mt-1 flex items-center gap-2 font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Production Ready</span>
          </div>
        </div>

        <ul className="flex flex-wrap gap-1 lg:flex-col">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                    active
                      ? "bg-brand-50 text-brand-700 shadow-sm border border-brand-200/60"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? "text-brand-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-auto shrink-0 flex flex-col gap-3 border-t border-slate-200 pt-3 bg-white">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
        >
          <ArrowLeft className="h-4 w-4 text-slate-500" />
          <span>Return to Dashboard</span>
        </Link>

        <UserProfileDropdown
          user={{ name, email, image, role }}
          dropDirection="up"
          className="w-full"
        />
      </div>
    </nav>
  );
}
