"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/organization", label: "Overview" },
  { href: "/dashboard/organization/members", label: "Members" },
  { href: "/dashboard/organization/invitations", label: "Invitations" },
  { href: "/dashboard/organization/teams", label: "Teams" },
  { href: "/dashboard/organization/settings", label: "Settings" },
];

/**
 * Persistent tabs across the organization section. Without this, a page
 * like Invitations has no way back to Members short of returning to the
 * overview's quick-links card first — every tab is always shown; a page a
 * viewer lacks permission for still renders (its own access-denied panel),
 * the same way AdminSidebar doesn't hide items per fine-grained permission.
 */
export function OrganizationSubNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Organization" className="flex flex-wrap gap-1 border-b border-slate-200 pb-2">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              active ? "bg-brand-50 text-brand-700 border border-brand-200/60" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
