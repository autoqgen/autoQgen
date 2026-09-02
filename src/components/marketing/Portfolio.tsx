import { Container, SectionHeading } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

const QUESTION_TYPES = [
  { code: "MCQ", label: "Multiple choice" },
  { code: "MULTIPLE_CORRECT", label: "Multiple correct" },
  { code: "TRUE_FALSE", label: "True / false" },
  { code: "SHORT", label: "Short answer" },
  { code: "WRITTEN", label: "Written / essay" },
  { code: "FILL_BLANK", label: "Fill in the blank" },
  { code: "MATCHING", label: "Matching pairs" },
  { code: "ASSERTION_REASON", label: "Assertion–reason" },
  { code: "IMAGE", label: "Image-based" },
  { code: "PASSAGE", label: "Passage-based" },
];

export function Portfolio() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Question types"
          title="Every format an exam board actually uses"
          description="Each type carries its own answer shape and validation rules, enforced the same way whether a question is created by hand or imported in bulk."
        />

        <RevealGroup className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {QUESTION_TYPES.map(({ code, label }) => (
            <RevealItem key={code}>
              <div className="h-full rounded-xl border border-slate-200 bg-card p-4 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm">
                <span className="text-[11px] font-semibold tracking-wide text-brand-700 uppercase">
                  {code.replace(/_/g, " ")}
                </span>
                <p className="mt-1.5 text-sm font-medium text-slate-800">{label}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
