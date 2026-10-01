import { Boxes, ClipboardCheck, FileOutput, Languages, ShieldCheck, UploadCloud } from "lucide-react";
import type { ComponentType } from "react";

import { Container, SectionHeading } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

interface Capability {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
}

const CAPABILITIES: Capability[] = [
  {
    icon: Boxes,
    title: "Structured taxonomy",
    body: "Category, subject, chapter and topic hierarchy, with board, exam and year metadata validated on every question.",
  },
  {
    icon: ClipboardCheck,
    title: "Review workflow",
    body: "Draft, pending, approved and rejected states with a permission-gated review queue, so only approved content is eligible for a paper.",
  },
  {
    icon: UploadCloud,
    title: "Bulk import",
    body: "Import CSV or JSON question files, up to 500 questions at once, with per-row validation and duplicate detection against the existing bank.",
  },
  {
    icon: FileOutput,
    title: "Paper generation & export",
    body: "Sample questions by chapter, type and difficulty, then export a formatted paper as PDF or DOCX.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Nine account roles, from member and student through reviewer, team admin and organisation owner, enforced in the API and UI.",
  },
  {
    icon: Languages,
    title: "Bangla & English",
    body: "Each question records its language, so Bangla and English content can live in the same organised bank.",
  },
];

export function Services() {
  return (
    <section id="capabilities" className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Capabilities"
          title="The core workflow, in one place"
          description="AutoQgen keeps the mechanics of question setting connected: organise, review, generate, build, and export."
        />

        <RevealGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title}>
              <article className="group h-full rounded-2xl border border-slate-200 bg-card p-6 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5">
                <div className="inline-flex rounded-lg bg-brand-50 p-2.5 text-brand-700">
                  <Icon aria-hidden className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
