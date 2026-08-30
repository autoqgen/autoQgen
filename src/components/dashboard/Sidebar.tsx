"use client";

import {
  Award,
  BookOpen,
  Bookmark,
  Building2,
  CheckSquare,
  FileText,
  FolderTree,
  HelpCircle,
  Layers,
  LayoutDashboard,
  PlusCircle,
  Settings,
  ShieldCheck,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserProfileDropdown } from "@/components/ui";
import type { UserRole } from "@/types/roles";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title?: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
    ],
  },
  {
    title: "Content & Papers",
    items: [
      { href: "/dashboard/papers", label: "Question papers", icon: FileText },
      { href: "/dashboard/questions", label: "Questions", icon: HelpCircle },
      { href: "/dashboard/questions/new", label: "New question", icon: PlusCircle },
      { href: "/dashboard/questions/import", label: "Bulk import", icon: Upload },
      { href: "/dashboard/review", label: "Review queue", icon: CheckSquare },
    ],
  },
  {
    title: "Taxonomy",
    items: [
      { href: "/dashboard/categories", label: "Categories", icon: FolderTree },
      { href: "/dashboard/subjects", label: "Subjects", icon: BookOpen },
      { href: "/dashboard/chapters", label: "Chapters", icon: Bookmark },
      { href: "/dashboard/topics", label: "Topics", icon: Layers },
      { href: "/dashboard/boards", label: "Boards", icon: Building2 },
      { href: "/dashboard/exams", label: "Exams", icon: Award },
    ],
  },
  {
    title: "Organization",
    items: [
      { href: "/dashboard/organization", label: "My Organization", icon: Building2 },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/dashboard/settings", label: "Settings", icon: Settings },
    ],
  },
];

export default function Sidebar({
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
  // Mirrors the /admin gate in rbac.ts — only super_admin holds any of the
  // platform-admin permissions the Admin Center requires.
  const isAdmin = role.toLowerCase() === "super_admin";

  return (
    <nav
      aria-label="Main"
      className="flex flex-col border-b border-slate-200 bg-white p-4 lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0"
    >
      <div className="flex items-center justify-between pb-4 shrink-0">
        <Link href="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-brand-700">
          <span>AutoQgen</span>
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto pr-0.5 flex flex-col gap-5 py-2">
        {isAdmin && (
          <div>
            <Link
              href="/admin"
              className="flex items-center gap-2.5 rounded-xl border border-brand-200 bg-brand-50/90 px-3 py-2 text-xs font-bold text-brand-700 shadow-sm transition hover:bg-brand-100 hover:border-brand-300"
            >
              <ShieldCheck className="h-4 w-4 text-brand-600" />
              <span>Admin Center</span>
            </Link>
          </div>
        )}

        {NAV_GROUPS.map((group, idx) => (
          <div key={group.title ?? idx} className="flex flex-col gap-1">
            {group.title && (
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                {group.title}
              </p>
            )}
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
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
        ))}
      </div>

      <div className="mt-auto shrink-0 border-t border-slate-200 pt-3 bg-white">
        <UserProfileDropdown
          user={{ name, email, image, role }}
          dropDirection="up"
          className="w-full"
        />
      </div>
    </nav>
  );
}
