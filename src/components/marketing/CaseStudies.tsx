import { CheckCircle2, FileEdit, FileOutput, ShieldCheck } from "lucide-react";
import type { ComponentType } from "react";

import { Container, SectionHeading } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

interface Stage {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  status: string;
  title: string;
  body: string;
}

const STAGES: Stage[] = [
  {
    icon: FileEdit,
    status: "01 · Draft",
    title: "A question is written",
    body: "A content writer picks a chapter, writes the question and answer, and saves it as a draft. A content hash is computed immediately, so a near-duplicate against the same chapter is caught before it is ever submitted.",
  },
  {
    icon: ShieldCheck,
    status: "02 · Pending",
    title: "It enters the queue",
    body: "Submitting for review moves the question to pending. It now shows up for anyone with review rights, filterable by status, and stays invisible to students until a decision is made.",
  },
  {
    icon: CheckCircle2,
    status: "03 · Approved",
    title: "A reviewer decides",
    body: "A reviewer approves or rejects, optionally with a note the author sees. Approval records who signed off and when — every decision is traceable, not just the current state.",
  },
  {
    icon: FileOutput,
    status: "04 · In a paper",
    title: "It becomes exam-ready",
    body: "Only approved questions are eligible for paper generation. Pick a chapter, a question mix and a mark scheme, and export the result as a formatted PDF or DOCX.",
  },
];

export function CaseStudies() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="How it works"
          title="From a first draft to an exam-ready paper"
          description="The same four-stage pipeline for every question, whether it was typed by hand or arrived through a bulk import."
        />

        <RevealGroup className="mt-12 grid gap-5 lg:grid-cols-4">
          {STAGES.map(({ icon: Icon, status, title, body }, index) => (
            <RevealItem key={status} className="relative">
              <div className="h-full rounded-2xl border border-slate-200 bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
                    {status}
                  </span>
                  <Icon aria-hidden className="h-5 w-5 text-slate-300" />
                </div>
                <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
              {index < STAGES.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="absolute top-1/2 -right-2.5 hidden h-px w-5 -translate-y-1/2 bg-slate-300 lg:block"
                />
              ) : null}
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
