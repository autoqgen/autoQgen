import { ArrowRight, Check, ClipboardCheck, FileText, Layers, Search, Sparkles, UploadCloud } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { getOptionalUser } from "@/lib/auth/session";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";
import { Container, Eyebrow } from "@/components/marketing/shared";

export type PublicPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  benefits: string[];
  steps: string[];
  kind?: "generation" | "bank" | "review" | "paper" | "import";
  children?: ReactNode;
};

export function InfoPage({ eyebrow, title, description, sections, links = [] }: { eyebrow: string; title: string; description: string; sections: { title: string; body: string; items?: string[] }[]; links?: { label: string; href: string }[] }) {
  const workflow = [
    { title: "Create", body: "Write, import, or generate a question.", icon: Sparkles },
    { title: "Review", body: "Edit and approve content before reuse.", icon: ClipboardCheck },
    { title: "Organise", body: "Find questions by their subject and topic context.", icon: Layers },
    { title: "Build & export", body: "Turn selected questions into a PDF or DOCX paper.", icon: FileText },
  ];

  return <main id="main"><section className="border-b border-slate-200 bg-slate-50/70 py-20 sm:py-24"><Container><Eyebrow>{eyebrow}</Eyebrow><h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{title}</h1><p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">{description}</p></Container></section><section className="py-12 sm:py-16"><Container><div className="rounded-2xl border border-slate-200 bg-card p-5 shadow-sm sm:p-7"><div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end"><div><Eyebrow>The workflow at a glance</Eyebrow><h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">From first draft to usable paper</h2></div><span className="text-xs font-medium text-slate-500">One connected workspace</span></div><div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{workflow.map(({ title: stepTitle, body, icon: Icon }, index) => <div key={stepTitle} className="relative rounded-xl bg-slate-50 p-4"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon className="h-4 w-4" /></span><span className="text-xs font-bold text-slate-400">0{index + 1}</span></div><h3 className="mt-4 text-sm font-semibold text-slate-900">{stepTitle}</h3><p className="mt-1 text-xs leading-relaxed text-slate-600">{body}</p></div>)}</div></div></Container></section><section className="pb-16 sm:pb-20"><Container className="grid gap-6 md:grid-cols-2">{sections.map((section) => <article key={section.title} className="rounded-2xl border border-slate-200 bg-card p-7"><h2 className="text-xl font-semibold text-slate-900">{section.title}</h2><p className="mt-3 text-sm leading-relaxed text-slate-600">{section.body}</p>{section.items && <ul className="mt-5 flex flex-col gap-3">{section.items.map((item) => <li key={item} className="flex gap-2 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{item}</li>)}</ul>}</article>)}</Container></section>{links.length > 0 && <section className="border-t border-slate-200 py-12"><Container><h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Continue exploring</h2><div className="mt-4 flex flex-wrap gap-3">{links.map((link) => <Link key={link.href} href={link.href} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">{link.label}<ArrowRight className="h-4 w-4" /></Link>)}</div></Container></section>}</main>;
}

export async function PublicShell({ children }: { children: ReactNode }) {
  const user = await getOptionalUser();
  return <><SiteHeader isLoggedIn={Boolean(user)} user={user ? { name: user.name, email: user.email, role: user.role } : null} />{children}<SiteFooter isLoggedIn={Boolean(user)} /></>;
}

export function PublicPage({ eyebrow, title, description, benefits, steps, kind = "generation", children }: PublicPageProps) {
  return (
    <main id="main">
      <section className="relative overflow-hidden border-b border-slate-200 bg-slate-50/70 py-20 sm:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgb(226_232_240/0.55)_1px,transparent_1px),linear-gradient(to_bottom,rgb(226_232_240/0.55)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <Container className="relative grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-center">
          <div><Eyebrow>{eyebrow}</Eyebrow><h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">{title}</h1><p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">{description}</p><div className="mt-8 flex flex-wrap gap-3"><Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">Get Started <ArrowRight className="h-4 w-4" /></Link><Link href="/resources/examples" className="rounded-lg border border-slate-300 bg-card px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">See Examples</Link></div></div>
          <ProductVisual kind={kind} />
        </Container>
      </section>
      <section className="py-20 sm:py-24"><Container className="grid gap-12 lg:grid-cols-2"><div><Eyebrow>Why it matters</Eyebrow><h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">A workflow that keeps the next step visible</h2><ul className="mt-7 flex flex-col gap-4">{benefits.map((benefit) => <li key={benefit} className="flex gap-3 text-slate-600"><Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />{benefit}</li>)}</ul></div><div className="rounded-2xl border border-slate-200 bg-card p-7"><Eyebrow>How it works</Eyebrow><ol className="mt-6 flex flex-col gap-5">{steps.map((step, index) => <li key={step} className="flex gap-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{index + 1}</span><span className="pt-1 text-sm font-medium text-slate-700">{step}</span></li>)}</ol></div></Container></section>
      {children}
      <section className="border-t border-slate-200 bg-slate-50 py-16"><Container className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><h2 className="text-2xl font-semibold text-slate-900">Make the next paper easier to build</h2><p className="mt-2 text-slate-600">Start with the workflow your team already uses.</p></div><Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Try AutoQgen <ArrowRight className="h-4 w-4" /></Link></Container></section>
    </main>
  );
}

function ProductVisual({ kind }: { kind: PublicPageProps["kind"] }) {
  const rows = kind === "generation" ? ["Subject: Biology", "Topic: Cell structure", "Difficulty: Medium"] : kind === "review" ? ["Generated · Pending", "Edit question", "Approve and save"] : kind === "paper" ? ["Section A · MCQ", "Section B · Short answer", "Export · PDF / DOCX"] : kind === "import" ? ["questions.csv", "Validated 48 / 50", "Add to question bank"] : ["Search questions...", "Biology · Cell structure", "Approved · Reusable"];
  const Icon = kind === "generation" ? Sparkles : kind === "import" ? UploadCloud : kind === "paper" ? FileText : Search;
  return <div className="rounded-2xl border border-slate-200 bg-card p-3 shadow-xl shadow-slate-900/10"><div className="rounded-xl bg-slate-50 p-5"><div className="flex items-center justify-between border-b border-slate-200 pb-4"><div className="flex items-center gap-2"><span className="rounded-lg bg-brand-600 p-2 text-white"><Icon className="h-4 w-4" /></span><span className="text-sm font-semibold text-slate-800">{kind === "generation" ? "Question generator" : "AutoQgen workspace"}</span></div><span className="h-2 w-2 rounded-full bg-emerald-500" /></div><div className="mt-5 flex flex-col gap-3">{rows.map((row, index) => <div key={row} className="flex items-center justify-between rounded-lg border border-slate-200 bg-card px-3 py-3 text-sm"><span className="text-slate-600">{row}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${index === rows.length - 1 ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"}`}>{index === rows.length - 1 ? "READY" : "SET"}</span></div>)}</div></div></div>;
}
