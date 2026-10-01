"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ThemeToggle, UserProfileDropdown } from "@/components/ui";

export function SiteHeader({
  isLoggedIn = false,
  user,
}: {
  isLoggedIn?: boolean;
  user?: { name?: string | null; email?: string | null; image?: string | null; role?: string | null; displayRole?: string | null } | null;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileOpenGroup, setMobileOpenGroup] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const publicNavRef = useRef<HTMLElement>(null);
  const plainUser = user
    ? { name: user.name ?? null, email: user.email ?? null, image: user.image ?? null, role: user.role ?? null, displayRole: user.displayRole ?? null }
    : null;

  useEffect(() => {
    if (!openMenu) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!publicNavRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="AutoQgen home" className="flex items-center transition-opacity hover:opacity-80">
          <Image src="/logo.png" alt="AutoQgen" width={154} height={42} priority className="site-logo h-8 w-auto object-contain" />
        </Link>

        {!isLoggedIn ? (
          <nav ref={publicNavRef} aria-label="Public navigation" className="hidden items-center gap-1 lg:flex">
            <NavMenu label="Platform" items={PLATFORM_LINKS} openMenu={openMenu} setOpenMenu={setOpenMenu} />
            <NavMenu label="Features" items={FEATURE_LINKS} openMenu={openMenu} setOpenMenu={setOpenMenu} />
            <NavMenu label="Solutions" items={SOLUTION_LINKS} openMenu={openMenu} setOpenMenu={setOpenMenu} />
            <NavMenu label="Resources" items={RESOURCE_LINKS} openMenu={openMenu} setOpenMenu={setOpenMenu} />
            <Link href="/pricing" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
              Pricing
            </Link>
          </nav>
        ) : (
          <nav aria-label="Application navigation" className="hidden items-center gap-1 lg:flex">
            <Link href="/dashboard" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Dashboard</Link>
            <Link href="/dashboard/questions/ai" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Generate</Link>
            <Link href="/dashboard/questions" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Question Bank</Link>
            <Link href="/dashboard/papers" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">Question Papers</Link>
          </nav>
        )}

        <div className="hidden items-center gap-3 lg:flex">
          <ThemeToggle className="hidden sm:inline-flex" />
          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="hidden sm:inline-flex items-center justify-center rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-700">
                Go to Dashboard
              </Link>
              <UserProfileDropdown user={plainUser} dropDirection="down" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-900">
                Sign in
              </Link>
              <Link href="/register" className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-700">
                Create an account
              </Link>
            </div>
          )}
        </div>

        <button
          type="button"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => {
            setMobileOpen((value) => !value);
            setMobileOpenGroup(null);
          }}
          className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-4 py-4 lg:hidden">
          <nav aria-label="Mobile public navigation" className="mx-auto flex max-w-7xl flex-col gap-1">
            {isLoggedIn ? (
              [
                { label: "Dashboard", href: "/dashboard", description: "See your current question and paper work." },
                { label: "Generate", href: "/dashboard/questions/ai", description: "Create AI-assisted question drafts." },
                { label: "Question Bank", href: "/dashboard/questions", description: "Search, edit, and reuse saved questions." },
                { label: "Question Papers", href: "/dashboard/papers", description: "Assemble and export papers." },
                { label: "Settings", href: "/dashboard/settings", description: "Manage your account preferences." },
              ].map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 transition hover:bg-slate-100">
                  <span className="block text-sm font-medium text-slate-700">{item.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span>
                </Link>
              ))
            ) : (
              MOBILE_NAV_GROUPS.map((group) => (
                <div key={group.label} className="rounded-xl border border-slate-200 bg-slate-50/50">
                  <button
                    type="button"
                    aria-expanded={mobileOpenGroup === group.label}
                    onClick={() => setMobileOpenGroup(mobileOpenGroup === group.label ? null : group.label)}
                    className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold text-slate-800"
                  >
                    {group.label}
                    <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${mobileOpenGroup === group.label ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${mobileOpenGroup === group.label ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="min-h-0 overflow-hidden border-t border-slate-200 px-1 py-1">
                      {group.items.map((item) => (
                        <Link key={`${item.label}-${item.href}`} href={item.href} onClick={() => { setMobileOpen(false); setMobileOpenGroup(null); }} className="block rounded-lg px-3 py-2.5 transition hover:bg-white">
                          <span className="block text-sm font-medium text-slate-700">{item.label}</span>
                          {item.description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
            <Link href="/pricing" onClick={() => setMobileOpen(false)} className="rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              Pricing
            </Link>
            <div className="mt-2 flex gap-2 border-t border-slate-200 pt-3">
              <Link href={isLoggedIn ? "/dashboard" : "/login"} onClick={() => setMobileOpen(false)} className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                {isLoggedIn ? "Dashboard" : "Login"}
              </Link>
              {!isLoggedIn && (
                <Link href="/register" onClick={() => setMobileOpen(false)} className="flex-1 rounded-xl bg-brand-600 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-brand-700">
                  Get Started
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

type NavLink = { label: string; href: string; description?: string };

const PLATFORM_LINKS: NavLink[] = [
  { label: "Overview", href: "/platform", description: "Follow the full flow from draft question to exported paper." },
  { label: "Question Bank", href: "/platform/question-bank", description: "Search questions by subject, topic, type, difficulty, and status." },
  { label: "Question Generation", href: "/platform/question-generation", description: "Choose context and generate a draft for review." },
  { label: "Question Review", href: "/platform/question-review", description: "Edit, approve, or reject questions before reuse." },
  { label: "Paper Builder", href: "/platform/paper-builder", description: "Select reviewed questions, arrange sections, and preview a paper." },
  { label: "Import & Export", href: "/platform/import-export", description: "Validate bulk imports and export papers as PDF or DOCX." },
];
const FEATURE_LINKS: NavLink[] = [
  { label: "AI Question Generation", href: "/platform/question-generation", description: "Generate structured drafts from subject and topic inputs." },
  { label: "Question Bank", href: "/platform/question-bank", description: "Keep questions organised and ready to reuse." },
  { label: "Question Review", href: "/platform/question-review", description: "Move content through draft, pending, approved, and rejected states." },
  { label: "Paper Generation", href: "/platform/paper-builder", description: "Turn selected questions into a structured paper." },
  { label: "Bulk Import", href: "/platform/import-export", description: "Import up to 500 questions with row validation and duplicate checks." },
  { label: "PDF & DOCX Export", href: "/platform/import-export", description: "Download completed papers in supported document formats." },
];
const SOLUTION_LINKS: NavLink[] = [
  { label: "For Teachers", href: "/solutions/teachers", description: "Build a personal bank for lessons, revision, and assessments." },
  { label: "For Coaching Centers", href: "/solutions/coaching-centers", description: "Reuse reviewed content for recurring paper preparation." },
  { label: "For Schools & Colleges", href: "/solutions/schools", description: "Keep authoring, review, and paper setting connected." },
  { label: "For Exam Setters", href: "/solutions/exam-setters", description: "Find reviewed questions and shape them into a final paper." },
];
const RESOURCE_LINKS: NavLink[] = [
  { label: "Guide", href: "/resources/guide", description: "Learn the create, review, organise, and export workflow." },
  { label: "Documentation", href: "/resources/docs", description: "See how the current dashboard workflows are organised." },
  { label: "FAQ", href: "/resources/faq", description: "Get direct answers about generation, imports, and exports." },
  { label: "Examples", href: "/resources/examples", description: "Inspect static question examples with subject and answer context." },
  { label: "Blog", href: "/resources/blog", description: "Read practical notes about building and reviewing question banks." },
  { label: "Changelog", href: "/resources/changelog", description: "See the latest changes to the product workflow." },
];

const MOBILE_NAV_GROUPS: { label: string; items: NavLink[] }[] = [
  { label: "Platform", items: PLATFORM_LINKS },
  { label: "Features", items: FEATURE_LINKS },
  { label: "Solutions", items: SOLUTION_LINKS },
  { label: "Resources", items: RESOURCE_LINKS },
];

function NavMenu({ label, items, openMenu, setOpenMenu }: { label: string; items: NavLink[]; openMenu: string | null; setOpenMenu: (value: string | null) => void }) {
  const open = openMenu === label;

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpenMenu(open ? null : label)}
        className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.22)]">
          {items.map((item, index) => (
            <Link
              key={`${item.label}-${item.href}-${index}`}
              href={item.href}
              onClick={() => setOpenMenu(null)}
              className="nav-dropdown-link group block rounded-xl px-3 py-2.5 transition hover:bg-brand-50 hover:text-brand-700"
            >
              <span className="block text-sm font-semibold text-slate-800">{item.label}</span>
              {item.description && <span className="nav-menu-description mt-0.5 block text-xs leading-relaxed text-slate-500">{item.description}</span>}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function SiteFooter({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-12">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:px-8">
        <div>
          <Link href="/" aria-label="AutoQgen home" className="flex items-center transition-opacity hover:opacity-80">
            <Image src="/logo.png" alt="AutoQgen" width={154} height={42} className="site-logo h-8 w-auto object-contain" />
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-600">
            A focused workflow for creating, reviewing, organising, and exporting exam questions.
          </p>
        </div>
        <FooterGroup title="Product" links={[...PLATFORM_LINKS.slice(0, 5), { label: "Features", href: "/features" }]} />
        <FooterGroup title="Solutions" links={SOLUTION_LINKS} />
        <FooterGroup title="Resources" links={[...RESOURCE_LINKS, { label: "Pricing", href: "/pricing" }, { label: "About", href: "/about" }, { label: "Contact", href: "/contact" }, { label: "Privacy", href: "/privacy" }, { label: "Terms", href: "/terms" }]} />
      </div>
      <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-3 border-t border-slate-200 px-4 pt-5 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <span>© {new Date().getFullYear()} AutoQgen</span>
        <div className="flex items-center gap-5">
          <ThemeToggle menuPlacement="top" />
          {isLoggedIn ? <Link href="/dashboard" className="transition hover:text-slate-900">Go to Dashboard</Link> : <Link href="/login" className="transition hover:text-slate-900">Sign in</Link>}
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }: { title: string; links: NavLink[] }) {
  return (
    <div>
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">{title}</h2>
      <ul className="mt-4 flex flex-col gap-2.5">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-sm text-slate-600 transition hover:text-brand-700">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
