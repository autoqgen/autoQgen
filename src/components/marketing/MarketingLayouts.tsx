import { ArrowRight, BookOpen, CircleHelp, FileCheck2, FileText, Layers3, MessageSquareText, Search, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";

import { Container, Eyebrow, MarketingHeroBackdrop, SectionHeading } from "@/components/marketing/shared";

const buttonPrimary = "inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(124,58,237,0.9)] transition hover:bg-brand-700";
const buttonSecondary = "inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700";

function ProductPanel({ mode }: { mode: "generation" | "bank" | "paper" }) {
  const content = {
    generation: { title: "Question generator", rows: ["Biology", "Cell structure", "Medium difficulty"] },
    bank: { title: "Question bank", rows: ["Approved · Biology", "Chapter · Cell structure", "48 questions found"] },
    paper: { title: "Paper builder", rows: ["Section A · MCQ", "Section B · Short answer", "Preview ready"] },
  }[mode];

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-3 shadow-[0_30px_80px_-36px_rgba(15,23,42,0.3)]">
      <div className="rounded-[1.5rem] bg-slate-50 p-5">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white"><Sparkles className="h-4 w-4" /></span>
            <span className="text-sm font-semibold text-slate-800">{content.title}</span>
          </div>
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        </div>
        <div className="mt-5 space-y-3">
          {content.rows.map((row, index) => (
            <div key={row} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm">
              <span className="text-slate-600">{row}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${index === content.rows.length - 1 ? "bg-emerald-50 text-emerald-700" : "bg-brand-50 text-brand-700"}`}>{index === content.rows.length - 1 ? "READY" : "SET"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function FeaturesLayout() {
  return (
    <main id="main">
      <section className="relative overflow-hidden border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(124,58,237,0.12),_transparent_42%),linear-gradient(to_bottom,_rgb(255,255,255),_rgb(248,250,252))] py-20 dark:bg-slate-950 dark:bg-none sm:py-28">
        <MarketingHeroBackdrop />
        <Container className="relative grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <Eyebrow>Product capabilities</Eyebrow>
            <h1 className="mt-5 max-w-2xl font-display text-5xl tracking-[-0.06em] text-slate-900 sm:text-7xl">The working parts of a better question workflow</h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">AutoQgen connects generation, review, organisation, paper building, and export without asking you to rebuild the same work in separate files.</p>
            <div className="mt-8 flex flex-wrap gap-3"><Link href="/register" className={buttonPrimary}>Create an account <ArrowRight className="h-4 w-4" /></Link><Link href="/platform" className={buttonSecondary}>See the platform</Link></div>
          </div>
          <ProductPanel mode="generation" />
        </Container>
      </section>

      <section className="border-b border-slate-200 py-16 sm:py-20">
        <Container>
          <SectionHeading eyebrow="One connected flow" title="Each feature earns its place in the next step" description="The product is organised around the work question setters already do, not a pile of disconnected tools." />
          <div className="mt-12 grid gap-0 border-y border-slate-200 md:grid-cols-4">
            {[{ label: "Create", body: "Generate or write a question.", icon: Sparkles }, { label: "Review", body: "Check wording and answers.", icon: FileCheck2 }, { label: "Organise", body: "Find the right context again.", icon: Layers3 }, { label: "Build", body: "Shape and export a paper.", icon: FileText }].map(({ label, body, icon: Icon }, index) => <div key={label} className="border-b border-slate-200 p-5 last:border-0 md:border-b-0 md:border-r md:last:border-r-0"><Icon className="h-5 w-5 text-brand-600" /><span className="mt-5 block text-xs font-bold uppercase tracking-[0.16em] text-slate-400">0{index + 1}</span><h2 className="mt-2 text-lg font-semibold text-slate-900">{label}</h2><p className="mt-1 text-sm leading-relaxed text-slate-600">{body}</p></div>)}
          </div>
        </Container>
      </section>

      <section className="py-20 sm:py-28">
        <Container className="space-y-24">
          <FeatureRow eyebrow="Generation" title="Start with the context you actually need" body="Choose subject, topic, question type, and difficulty to create a structured draft. The draft is a starting point for review, not a claim that the work is finished." mode="generation" />
          <FeatureRow eyebrow="Question bank" title="Keep useful questions findable" body="Use taxonomy and status to search the bank, inspect answer details, and bring approved content into a future paper." mode="bank" reverse />
          <FeatureRow eyebrow="Paper building" title="Move from selected questions to a paper" body="Arrange sections and instructions, preview the result, and export the finished paper as PDF or DOCX." mode="paper" />
        </Container>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-20 dark:bg-slate-950 sm:py-24">
        <Container>
          <SectionHeading eyebrow="Available today" title="The feature set, with the important boundaries included" description="These are implemented workflows in the current application. Some actions depend on the account role or organization membership." />
          <div className="mt-12 divide-y divide-slate-300 border-y border-slate-300">
            {[
              { title: "AI question generation", body: "Generate MCQ, multiple-correct, true/false, short, written, and fill-in-the-blank drafts; creative-question generation is also supported. Generation and AI import are permission-gated." },
              { title: "Question bank and taxonomy", body: "Organize questions by category, subject, chapter, topic, board, exam, year, type, difficulty, language, and status, then search and filter the bank." },
              { title: "Review and bulk review", body: "Move questions through draft, pending, approved, and rejected states. Reviewers can approve or reject individual questions, with bulk review available for permitted accounts." },
              { title: "CSV and JSON import", body: "Upload question files with row-level validation and duplicate checks. Each request accepts up to 500 questions, and the app also provides a CSV template." },
              { title: "Paper builder and templates", body: "Build papers manually or with automatic selection, configure chapter, difficulty, type, marks, and sections, and load saved question-pattern templates when permitted." },
              { title: "PDF and DOCX paper export", body: "Export student or teacher copies in PDF or DOCX. Teacher copies include answers and require the corresponding permission." },
              { title: "Paper similarity review", body: "Review semantically similar questions within a paper before finalizing it, then keep or replace flagged questions when the workflow allows it." },
            ].map(({ title, body }) => (
              <div key={title} className="grid gap-3 py-6 sm:grid-cols-[0.35fr_1fr] sm:gap-8">
                <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-900">{title}</h3>
                <p className="max-w-3xl text-base leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
          <p className="mt-6 max-w-3xl text-sm leading-relaxed text-slate-500"><span className="font-semibold text-slate-700">Not part of the current product:</span> CSV paper export, analytics dashboards, external integrations, and unverified collaboration or enterprise claims are intentionally not presented as available features.</p>
        </Container>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 py-16 dark:bg-slate-950 sm:py-20"><Container className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><Eyebrow>Start with the workflow</Eyebrow><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-900">Make the next paper easier to build</h2></div><Link href="/register" className={buttonPrimary}>Try AutoQgen <ArrowRight className="h-4 w-4" /></Link></Container></section>
    </main>
  );
}

function FeatureRow({ eyebrow, title, body, mode, reverse = false }: { eyebrow: string; title: string; body: string; mode: "generation" | "bank" | "paper"; reverse?: boolean }) {
  return <div className={`grid gap-10 lg:grid-cols-2 lg:items-center ${reverse ? "lg:[&>div:first-child]:order-2" : ""}`}><div><Eyebrow>{eyebrow}</Eyebrow><h2 className="mt-4 max-w-lg text-3xl font-semibold tracking-[-0.05em] text-slate-900 sm:text-4xl">{title}</h2><p className="mt-5 max-w-lg text-lg leading-relaxed text-slate-600">{body}</p><Link href={mode === "generation" ? "/platform/question-generation" : mode === "bank" ? "/platform/question-bank" : "/platform/paper-builder"} className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">Explore this workflow <ArrowRight className="h-4 w-4" /></Link></div><ProductPanel mode={mode} /></div>;
}

export function SolutionsLayout() {
  const audiences = [{ title: "Teachers", body: "Build a personal bank for lessons, revision, and recurring assessments.", href: "/solutions/teachers", icon: BookOpen }, { title: "Coaching centres", body: "Make recurring paper preparation easier to repeat and review.", href: "/solutions/coaching-centers", icon: Layers3 }, { title: "Schools and colleges", body: "Give authors, reviewers, and setters a visible path to a paper.", href: "/solutions/schools", icon: UsersRound }, { title: "Exam setters", body: "Find reviewed questions and shape them into a final document.", href: "/solutions/exam-setters", icon: FileCheck2 }];
  return <main id="main"><section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(120deg,_rgb(248,250,252),_rgb(255,255,255))] py-20 dark:bg-slate-950 dark:bg-none sm:py-28"><MarketingHeroBackdrop /><Container className="relative max-w-4xl"><Eyebrow>Solutions by audience</Eyebrow><h1 className="mt-5 max-w-3xl font-display text-5xl tracking-[-0.06em] text-slate-900 sm:text-7xl">The same workflow, shaped around the people using it</h1><p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">Different question-setting contexts need different starting points. The underlying flow stays grounded: create, review, organise, build, export.</p></Container></section><section className="py-20 sm:py-24"><Container><SectionHeading eyebrow="Choose a starting point" title="Start with the work in front of you" /><div className="mt-12 grid gap-x-8 gap-y-0 md:grid-cols-2">{audiences.map(({ title, body, href, icon: Icon }) => <Link key={href} href={href} className="group border-b border-slate-200 py-7 first:border-t md:nth-[2]:border-t"><Icon className="h-5 w-5 text-brand-600" /><div className="mt-4 flex items-center justify-between gap-5"><h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">{title}</h2><ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600" /></div><p className="mt-2 max-w-md text-base leading-relaxed text-slate-600">{body}</p></Link>)}</div></Container></section><section className="border-y border-slate-200 bg-slate-50 py-16 dark:bg-slate-950 sm:py-20"><Container className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr] lg:items-start"><div><Eyebrow>Shared foundation</Eyebrow><h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-900">A dependable path from draft to document</h2></div><div className="grid gap-4 sm:grid-cols-2">{["Create or import questions", "Review wording, answers, and context", "Search and reuse approved content", "Preview and export a paper"].map((item, index) => <div key={item} className="flex gap-3 border-t border-slate-300 pt-4"><span className="text-sm font-bold text-brand-600">0{index + 1}</span><span className="text-base text-slate-700">{item}</span></div>)}</div></Container></section></main>;
}

export function ResourcesLayout() {
  const resources = [{ title: "The question-to-paper guide", type: "Guide", description: "A practical orientation to creating, reviewing, organising, and exporting.", href: "/resources/guide" }, { title: "Current product documentation", type: "Documentation", description: "Understand the workflows available in the application today.", href: "/resources/docs" }, { title: "Question examples", type: "Examples", description: "Inspect the context that makes a question ready to reuse.", href: "/resources/examples" }, { title: "Frequently asked questions", type: "FAQ", description: "Direct answers about generation, import, review, and export.", href: "/resources/faq" }];
  return <main id="main"><section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(to_bottom,_rgb(255,255,255),_rgb(248,250,252))] py-20 dark:bg-slate-950 dark:bg-none sm:py-24"><MarketingHeroBackdrop /><Container className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-end"><div><Eyebrow>Resources</Eyebrow><h1 className="mt-5 max-w-3xl font-display text-5xl tracking-[-0.06em] text-slate-900 sm:text-7xl">A useful shelf for the work behind every paper</h1><p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">Start with the guide, look at examples, or find direct answers about the current AutoQgen workflow.</p></div><div className="border-l-2 border-brand-500 pl-5"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-brand-700">Featured resource</p><Link href="/resources/guide" className="mt-3 block text-2xl font-semibold tracking-[-0.04em] text-slate-900 hover:text-brand-700">The question-to-paper guide <ArrowRight className="ml-1 inline h-5 w-5" /></Link><p className="mt-2 text-sm leading-relaxed text-slate-600">A concise path for a new workspace or a new collaborator.</p></div></Container></section><section className="py-20 sm:py-24"><Container><div className="flex items-end justify-between gap-6 border-b border-slate-200 pb-5"><div><Eyebrow>Browse by need</Eyebrow><h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-900">Find the next useful answer</h2></div><Search className="hidden h-6 w-6 text-slate-400 sm:block" /></div><div className="divide-y divide-slate-200">{resources.map(({ title, type, description, href }) => <Link key={href} href={href} className="group grid gap-3 py-7 sm:grid-cols-[0.3fr_1fr_auto] sm:items-center"><span className="text-xs font-bold uppercase tracking-[0.16em] text-brand-700">{type}</span><div><h3 className="text-xl font-semibold text-slate-900 group-hover:text-brand-700">{title}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p></div><ArrowRight className="h-5 w-5 text-slate-400 transition group-hover:translate-x-1 group-hover:text-brand-600" /></Link>)}</div></Container></section><section className="border-t border-slate-200 bg-slate-50 py-16 dark:bg-slate-950 sm:py-20"><Container className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"><div><Eyebrow>Still deciding?</Eyebrow><h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-900">See the workflow in the product</h2></div><Link href="/register" className={buttonPrimary}>Get started <ArrowRight className="h-4 w-4" /></Link></Container></section></main>;
}

export function AboutLayout() {
  return <main id="main"><section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(120deg,_rgb(248,250,252),_rgb(255,255,255))] py-24 dark:bg-slate-950 dark:bg-none sm:py-32"><MarketingHeroBackdrop /><Container className="relative max-w-5xl"><Eyebrow>About AutoQgen</Eyebrow><h1 className="mt-6 max-w-4xl font-display text-6xl leading-[0.98] tracking-[-0.07em] text-slate-900 sm:text-8xl">Question work deserves a calmer system.</h1><p className="mt-8 max-w-2xl text-xl leading-relaxed text-slate-600">AutoQgen is built around the practical work behind assessments: keeping questions organised, reviewable, reusable, and ready to export.</p></Container></section><section className="py-20 sm:py-28"><Container className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]"><div><Eyebrow>Why it exists</Eyebrow><h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-900 sm:text-4xl">The work is important. The scattered files are not.</h2></div><div className="space-y-6 text-lg leading-relaxed text-slate-600"><p>Question setting often spans documents, spreadsheets, generated drafts, review notes, and paper files. The cost is not only time; it is losing the context that makes a question useful.</p><p>AutoQgen brings those steps closer together without pretending that generation removes the need for human judgment.</p></div></Container></section><section className="border-y border-slate-200 bg-slate-50 py-20 dark:bg-slate-950 sm:py-24"><Container><SectionHeading eyebrow="Principles" title="A product shaped by the work itself" /><div className="mt-12 grid gap-8 md:grid-cols-3">{[{ title: "Context stays attached", body: "Subject, chapter, topic, type, difficulty, and status make a question findable later." }, { title: "Review is visible", body: "Drafts and approvals are part of the workflow instead of hidden decisions." }, { title: "Output stays practical", body: "The work ends with a paper preview and supported PDF or DOCX export." }].map(({ title, body }, index) => <div key={title} className="border-t-2 border-brand-500 pt-5"><span className="text-sm font-bold text-brand-600">0{index + 1}</span><h3 className="mt-5 text-xl font-semibold text-slate-900">{title}</h3><p className="mt-2 text-base leading-relaxed text-slate-600">{body}</p></div>)}</div></Container></section></main>;
}

export function ContactLayout() {
  const options = [{ title: "Learn the workflow", body: "Start with the guide, documentation, and FAQ for direct product context.", href: "/resources/guide", label: "Open resources", icon: BookOpen }, { title: "Get account help", body: "Sign in to use the account and settings areas available to your workspace.", href: "/login", label: "Sign in", icon: UsersRound }, { title: "Start building", body: "Create an account and try the current question-to-paper workflow.", href: "/register", label: "Create an account", icon: MessageSquareText }];
  return <main id="main"><section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(to_bottom,_rgb(255,255,255),_rgb(248,250,252))] py-20 dark:bg-slate-950 dark:bg-none sm:py-24"><MarketingHeroBackdrop /><Container className="relative max-w-4xl"><Eyebrow>Contact</Eyebrow><h1 className="mt-5 max-w-3xl font-display text-5xl tracking-[-0.06em] text-slate-900 sm:text-7xl">Find the right next step.</h1><p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">AutoQgen is still a focused product. Choose the path that matches what you need instead of searching through a generic contact funnel.</p></Container></section><section className="py-20 sm:py-24"><Container><div className="grid gap-0 border-y border-slate-200 md:grid-cols-3">{options.map(({ title, body, href, label, icon: Icon }) => <div key={title} className="border-b border-slate-200 p-6 last:border-0 md:border-b-0 md:border-r md:last:border-r-0"><Icon className="h-5 w-5 text-brand-600" /><h2 className="mt-6 text-2xl font-semibold tracking-[-0.04em] text-slate-900">{title}</h2><p className="mt-3 min-h-20 text-sm leading-relaxed text-slate-600">{body}</p><Link href={href} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-700">{label}<ArrowRight className="h-4 w-4" /></Link></div>)}</div></Container></section><section className="border-t border-slate-200 bg-slate-50 py-16 dark:bg-slate-950 sm:py-20"><Container className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]"><div><Eyebrow>Common questions</Eyebrow><h2 className="mt-4 text-3xl font-semibold tracking-[-0.05em] text-slate-900">Need a quick answer?</h2></div><div className="divide-y divide-slate-300 border-y border-slate-300">{[{ q: "Can I review generated questions?", a: "Yes. Generated questions can move through the review workflow before reuse." }, { q: "Can I import existing questions?", a: "Yes. Bulk import validates rows and checks for duplicates." }, { q: "What can I export?", a: "Completed papers can be exported as PDF or DOCX." }].map(({ q, a }) => <div key={q} className="py-5"><div className="flex gap-3"><CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" /><div><h3 className="font-semibold text-slate-900">{q}</h3><p className="mt-1 text-sm leading-relaxed text-slate-600">{a}</p></div></div></div>)}</div></Container></section></main>;
}
