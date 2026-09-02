import { Container, SectionHeading } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

const STEPS = [
  {
    step: "1",
    title: "Create an account",
    body: "Sign up and land in a workspace scoped to your role — nothing to configure before you can start.",
  },
  {
    step: "2",
    title: "Add or import questions",
    body: "Write questions by hand, or bulk-import up to 500 at once with per-row validation.",
  },
  {
    step: "3",
    title: "Send them for review",
    body: "Submit for review and let a reviewer approve, reject or send it back with a note.",
  },
  {
    step: "4",
    title: "Generate & export a paper",
    body: "Set a chapter, type and difficulty mix, then export the result as PDF or DOCX.",
  },
];

export function Process() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Getting started"
          title="Four steps from sign-up to your first paper"
          align="center"
        />

        <RevealGroup className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ step, title, body }) => (
            <RevealItem key={step} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-card text-sm font-semibold text-slate-700">
                {step}
              </div>
              <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
