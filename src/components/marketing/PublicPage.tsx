import { ArrowRight, Check, ClipboardCheck, FileText, Layers, Search, Sparkles, UploadCloud } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";
import { Container, Eyebrow, MarketingHeroBackdrop } from "@/components/marketing/shared";
import { getOptionalUser } from "@/lib/auth/session";
import { resolveDisplayRole } from "@/lib/auth/role-display";

export type PublicPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  benefits: string[];
  steps: string[];
  kind?: "generation" | "bank" | "review" | "paper" | "import";
  children?: ReactNode;
};

export function InfoPage({
  eyebrow,
  title,
  description,
  sections,
  links = [],
}: {
  eyebrow: string;
  title: string;
  description: string;
  sections: { title: string; body: string; items?: string[] }[];
  links?: { label: string; href: string }[];
}) {
  const workflow = [
    { title: "Create", body: "Write, import, or generate a question.", icon: Sparkles },
    { title: "Review", body: "Edit and approve content before reuse.", icon: ClipboardCheck },
    { title: "Organise", body: "Find questions by their subject and topic context.", icon: Layers },
    { title: "Build & export", body: "Turn selected questions into a PDF or DOCX paper.", icon: FileText },
  ];

  return (
    <main id="main">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.1),_transparent_48%),linear-gradient(to_bottom,_rgb(255,255,255),_rgb(248,250,252))] py-20 sm:py-24 dark:bg-slate-950 dark:bg-none">
        <MarketingHeroBackdrop />
        <Container className="relative">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-5 max-w-3xl font-display text-5xl tracking-[-0.06em] text-slate-900 sm:text-6xl">{title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{description}</p>
        </Container>
      </section>

      <section className="py-16 sm:py-20">
        <Container>
          <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-[0_16px_60px_-35px_rgba(15,23,42,0.2)] sm:p-7">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <Eyebrow>Workflow</Eyebrow>
                <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-3xl">From first draft to usable paper</h2>
              </div>
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-slate-500">One connected workspace</span>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {workflow.map(({ title: stepTitle, body, icon: Icon }, index) => (
                <div key={stepTitle} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">0{index + 1}</span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{stepTitle}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <section className="pb-16 sm:pb-20">
        <Container className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            {sections.map((section) => (
              <article key={section.title} className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">{section.title}</h2>
                <p className="mt-3 text-base leading-relaxed text-slate-600">{section.body}</p>
                {section.items && (
                  <ul className="mt-5 flex flex-col gap-3">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3 text-sm text-slate-700">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
            <Eyebrow>Why it works</Eyebrow>
            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-slate-900">Less friction between drafting and final output</h2>
            <ul className="mt-6 space-y-4">
              {[
                "Questions stay structured with the subject, chapter, topic, and difficulty that matter.",
                "Review steps are visible before a question becomes reusable in future papers.",
                "The final paper is built from approved content instead of disconnected files.",
              ].map((item) => (
                <li key={item} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>

      {links.length > 0 && (
        <section className="border-t border-slate-200 bg-slate-50 py-14">
          <Container className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">Continue exploring</h2>
              <p className="mt-2 text-slate-600">Useful next steps for the current AutoQgen workflow.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {links.map((link) => (
                <Link key={link.href} href={link.href} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                  {link.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}
    </main>
  );
}

export async function PublicShell({ children }: { children: ReactNode }) {
  const user = await getOptionalUser();
  const displayRole = user ? await resolveDisplayRole(user) : null;

  return (
    <div className="marketing-site">
      <SiteHeader isLoggedIn={Boolean(user)} user={user ? { name: user.name, email: user.email, role: user.role, displayRole } : null} />
      {children}
      <SiteFooter isLoggedIn={Boolean(user)} />
    </div>
  );
}

export function PublicPage({ eyebrow, title, description, benefits, steps, kind = "generation", children }: PublicPageProps) {
  return (
    <main id="main">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top,_rgba(124,58,237,0.1),_transparent_48%),linear-gradient(to_bottom,_rgb(255,255,255),_rgb(248,250,252))] py-20 sm:py-28 dark:bg-slate-950 dark:bg-none">
        <MarketingHeroBackdrop />
        <Container className="relative grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="mt-5 max-w-3xl font-display text-5xl tracking-[-0.06em] text-slate-900 sm:text-6xl">{title}</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">{description}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(124,58,237,0.9)] transition hover:bg-brand-700">
                Get Started
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/resources/examples" className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
                See Examples
              </Link>
            </div>
          </div>
          <ProductVisual kind={kind} />
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Eyebrow>Why it matters</Eyebrow>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-900 sm:text-4xl">A workflow that keeps the next step visible</h2>
            <ul className="mt-7 space-y-4">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-slate-700">
                  <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_60px_-35px_rgba(15,23,42,0.2)]">
            <Eyebrow>How it works</Eyebrow>
            <ol className="mt-6 space-y-5">
              {steps.map((step, index) => (
                <li key={step} className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{index + 1}</span>
                  <span className="pt-1 text-sm font-medium text-slate-700">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </section>

      {children}

      <section className="border-t border-slate-200 bg-slate-50 py-16">
        <Container className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">Make the next paper easier to build</h2>
            <p className="mt-2 text-slate-600">Start with the workflow your team already uses.</p>
          </div>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">
            Try AutoQgen
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Container>
      </section>
    </main>
  );
}

function ProductVisual({ kind }: { kind: PublicPageProps["kind"] }) {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_32px_80px_-30px_rgba(15,23,42,0.24)]">
      <div className="rounded-[1.5rem] bg-slate-50 p-5">
        {kind === "generation" && <GenerationVisual />}
        {kind === "bank" && <BankVisual />}
        {kind === "review" && <ReviewVisual />}
        {kind === "paper" && <PaperVisual />}
        {kind === "import" && <ImportVisual />}
      </div>
    </div>
  );
}

function WorkspaceHeader({ icon: Icon, title }: { icon: typeof Sparkles; title: string }) {
  return <div className="flex items-center justify-between border-b border-slate-200 pb-4"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><Icon className="h-4 w-4" /></span><span className="text-sm font-semibold text-slate-800">{title}</span></div><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /></div>;
}

function PreviewField({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2"><span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</span><span className="mt-1 block truncate text-xs font-medium text-slate-700">{value}</span></div>;
}

function StatusPill({ children, tone = "brand" }: { children: ReactNode; tone?: "brand" | "green" | "amber" }) {
  const styles = { brand: "bg-brand-50 text-brand-700", green: "bg-emerald-50 text-emerald-700", amber: "bg-amber-50 text-amber-700" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${styles[tone]}`}>{children}</span>;
}

function GenerationVisual() {
  return <><WorkspaceHeader icon={Sparkles} title="AI question generation" /><div className="mt-5 grid grid-cols-2 gap-2"><PreviewField label="Category" value="Class 7" /><PreviewField label="Subject" value="Biology" /><PreviewField label="Chapter" value="Cell structure" /><PreviewField label="Topic" value="Cell membrane" /></div><div className="mt-3 grid grid-cols-3 gap-2"><PreviewField label="Type" value="MCQ" /><PreviewField label="Difficulty" value="Medium" /><PreviewField label="Language" value="বাংলা" /></div><div className="mt-4 flex items-center justify-between rounded-xl border border-brand-200 bg-brand-50 px-3 py-3"><div><span className="block text-xs font-semibold text-brand-900">10 questions</span><span className="text-[11px] text-brand-700">Review candidates before import</span></div><span className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-semibold text-white">Generate</span></div></>;
}

function BankVisual() {
  return <><WorkspaceHeader icon={Search} title="Question bank" /><div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500"><Search className="h-3.5 w-3.5" />Search questions...</div><div className="mt-3 grid grid-cols-3 gap-2"><PreviewField label="Subject" value="Biology" /><PreviewField label="Status" value="Approved" /><PreviewField label="Type" value="All types" /></div><div className="mt-4 space-y-2">{["Cell structure and function", "Photosynthesis basics", "Human body systems"].map((question, index) => <div key={question} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5"><div className="min-w-0"><span className="block truncate text-xs font-medium text-slate-700">{question}</span><span className="text-[10px] text-slate-400">Biology · Chapter {index + 1}</span></div><StatusPill tone="green">APPROVED</StatusPill></div>)}</div></>;
}

function ReviewVisual() {
  return <><WorkspaceHeader icon={ClipboardCheck} title="Review queue" /><div className="mt-5 grid gap-3 lg:grid-cols-[0.85fr_1.15fr]"><div className="space-y-2">{["Generated question", "Imported question", "Short answer draft"].map((item, index) => <div key={item} className={`rounded-lg border px-3 py-3 ${index === 0 ? "border-brand-300 bg-brand-50" : "border-slate-200 bg-white"}`}><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-700">{item}</span><StatusPill tone="amber">PENDING</StatusPill></div><span className="mt-1 block text-[10px] text-slate-400">Biology · Cell structure</span></div>)}</div><div className="rounded-lg border border-slate-200 bg-white p-4"><span className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Question preview</span><p className="mt-3 text-xs font-medium leading-relaxed text-slate-700">Which structure controls movement of substances into and out of a cell?</p><div className="mt-4 flex gap-2"><span className="rounded-lg border border-slate-300 px-3 py-2 text-[11px] font-semibold text-slate-700">Reject</span><span className="rounded-lg bg-brand-600 px-3 py-2 text-[11px] font-semibold text-white">Approve</span></div></div></div></>;
}

function PaperVisual() {
  return <><WorkspaceHeader icon={FileText} title="Paper builder" /><div className="mt-5 grid grid-cols-2 gap-2"><PreviewField label="Title" value="Biology Practice Test" /><PreviewField label="Paper type" value="Model test" /><PreviewField label="Category" value="Class 7" /><PreviewField label="Subject" value="Biology" /></div><div className="mt-4 rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between"><span className="text-xs font-semibold text-slate-700">Question selection</span><StatusPill tone="green">25 questions</StatusPill></div><div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px]"><div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Difficulty</span><span className="mt-1 block font-semibold text-slate-700">Balanced</span></div><div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Types</span><span className="mt-1 block font-semibold text-slate-700">Mixed</span></div><div className="rounded-lg bg-slate-50 p-2"><span className="block text-slate-400">Preview</span><span className="mt-1 block font-semibold text-emerald-700">Ready</span></div></div></div></>;
}

function ImportVisual() {
  return <><WorkspaceHeader icon={UploadCloud} title="Bulk import" /><div className="mt-5 grid grid-cols-3 gap-2"><PreviewField label="Category" value="Class 7" /><PreviewField label="Subject" value="Biology" /><PreviewField label="Chapter" value="Cell structure" /></div><div className="mt-4 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50 p-5 text-center"><UploadCloud className="mx-auto h-6 w-6 text-brand-600" /><span className="mt-2 block text-xs font-semibold text-brand-900">questions.csv or questions.json</span><span className="mt-1 block text-[10px] text-brand-700">Up to 500 questions per request</span></div><div className="mt-3 flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-3"><div><span className="block text-xs font-semibold text-slate-700">Validation summary</span><span className="text-[10px] text-slate-400">48 valid · 2 duplicate</span></div><StatusPill tone="green">READY TO IMPORT</StatusPill></div></>;
}
