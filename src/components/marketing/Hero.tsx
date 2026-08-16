import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";

import { Container } from "@/components/marketing/shared";
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
    <section className="relative overflow-hidden">
      {/* Mesh/grid backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(226_232_240/0.7)_1px,transparent_1px),linear-gradient(to_bottom,rgb(226_232_240/0.7)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black_45%,transparent_100%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[860px] -translate-x-1/2 rounded-full bg-brand-500/15 blur-[110px]"
      />

      <Container className="pt-20 pb-16 sm:pt-28 sm:pb-24">
        <RevealGroup className="flex flex-col items-center text-center">
          <RevealItem>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
              <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-brand-600" />
              Bangla &amp; English question banks, one workflow
            </span>
          </RevealItem>

          <RevealItem>
            <h1 className="mt-6 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
              Build exam-ready question banks without the spreadsheet chaos
            </h1>
          </RevealItem>

          <RevealItem>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-balance text-slate-600">
              AutoQgen organises questions by board, subject, chapter and topic, routes every
              submission through review, and turns an approved set into a formatted paper in
              minutes.
            </p>
          </RevealItem>

          <RevealItem>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
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
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </RevealItem>

          <RevealItem className="mt-16 w-full">
            <div className="relative mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white/90 p-2 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_20px_60px_-15px_rgb(15_23_42/0.18)] backdrop-blur">
              <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:p-6">
                <div className="flex items-center gap-1.5 pb-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="ml-3 text-xs font-medium text-slate-400">Review queue</span>
                </div>
                <ul className="flex flex-col gap-2">
                  {PREVIEW_ROWS.map((row) => (
                    <li
                      key={row.chapter}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-left"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="shrink-0 rounded-md bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
                          {row.type.replace(/_/g, " ")}
                        </span>
                        <span className="truncate text-sm text-slate-700">{row.chapter}</span>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${STATUS_STYLE[row.status]}`}
                      >
                        {row.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </RevealItem>
        </RevealGroup>
      </Container>
    </section>
  );
}
