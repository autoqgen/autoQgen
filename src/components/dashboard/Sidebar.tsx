"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserProfileDropdown } from "@/components/ui";
import type { UserRole } from "@/types/roles";

const NAV = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/papers", label: "Question papers" },
  { href: "/dashboard/questions", label: "Questions" },
  { href: "/dashboard/questions/new", label: "New question" },
  { href: "/dashboard/questions/import", label: "Bulk import" },
  { href: "/dashboard/review", label: "Review" },
  { href: "/dashboard/categories", label: "Categories" },
  { href: "/dashboard/subjects", label: "Subjects" },
  { href: "/dashboard/chapters", label: "Chapters" },
  { href: "/dashboard/topics", label: "Topics" },
  { href: "/dashboard/boards", label: "Boards" },
  { href: "/dashboard/exams", label: "Exams" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default function Sidebar({ name, email, role }: { name: string; email: string; role: UserRole }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="flex flex-col gap-6 border-b border-slate-200 bg-white p-4 lg:h-screen lg:w-64 lg:shrink-0 lg:border-r lg:border-b-0"
    >
      <Link href="/" className="text-lg font-bold text-brand-700">
        AutoQgen
      </Link>

      <ul className="flex flex-wrap gap-1 lg:flex-col">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-auto border-t border-slate-200 pt-4">
        <UserProfileDropdown
          user={{ name, email, role }}
          dropDirection="up"
          className="w-full"
        />
      </div>
    </nav>
  );
}
