import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Container, MarketingHeroBackdrop } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

const PREVIEW_ROWS = [
  { type: "MCQ", chapter: "কোষ ও এর গঠন", status: "APPROVED" as const },
  { type: "TRUE_FALSE", chapter: "নিউটনের সূত্র", status: "PENDING" as const },
  { type: "SHORT", chapter: "রাসায়নিক বন্ধন", status: "PENDING" as const },
  { type: "MATCHING", chapter: "ভগ্নাংশ", status: "DRAFT" as const },
];

const STATUS_STYLE: Record<string, string> = {
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/20",
  DRAFT: "bg-slate-100 text-slate-600 ring-slate-500/20",
};

export function Hero({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(to_bottom,_rgb(255,255,255),_rgb(248,250,252))] dark:bg-slate-950 dark:bg-none">
      <MarketingHeroBackdrop />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[110px]"
      />

      <Container className="relative grid gap-12 py-20 sm:py-28 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
        <RevealGroup className="max-w-xl">
          <RevealItem>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              Create · review · build · export
            </p>
            <h1 className="mt-5 max-w-xl text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-slate-900 sm:text-6xl">
              Make every question easier to find and ready to use
            </h1>
          </RevealItem>

          <RevealItem>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-600">
              AutoQgen keeps questions organised by category, subject, chapter, topic, type,
              difficulty, language, and review status, then helps turn approved content into a
              paper.
            </p>
          </RevealItem>

          <RevealItem>
            <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
                >
                  Go to Dashboard
                  <ArrowRight
                    aria-hidden="true"
                    className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              ) : (
                <>
                  <Link
                    href="/register"
                    className="group inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
                  >
                    Create an account
                    <ArrowRight
                      aria-hidden="true"
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-card px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </RevealItem>
        </RevealGroup>

        <RevealGroup>
          <RevealItem>
            <div className="relative rounded-2xl border border-slate-200 bg-card/90 p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_24px_70px_-18px_rgb(15_23_42/0.2)] backdrop-blur">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:p-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /></div>
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Review queue</span>
                </div>
                <ul className="mt-5 flex flex-col gap-2">
                  {PREVIEW_ROWS.map((row) => <li key={row.chapter} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-card px-3.5 py-3 text-left"><div className="flex min-w-0 items-center gap-3"><span className="shrink-0 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">{row.type.replace(/_/g, " ")}</span><span className="truncate text-sm text-slate-700">{row.chapter}</span></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLE[row.status]}`}>{row.status}</span></li>)}
                </ul>
              </div>
            </div>
          </RevealItem>
        </RevealGroup>
      </Container>
    </section>
  );
}
