import { Container, SectionHeading } from "@/components/marketing/shared";
import { FaqItem } from "@/components/marketing/FaqItem";

const FAQS = [
  {
    question: "Does it support Bangla and English at the same time?",
    answer:
      "Yes. Every question, option and answer carries a language field, so a bank can hold Bangla and English questions side by side without a separate translation step.",
  },
  {
    question: "How is a question checked for duplicates?",
    answer:
      "A content fingerprint is computed from the question text and its chapter, and checked on every save and every bulk import — a near-identical question in the same chapter is rejected before it's stored.",
  },
  {
    question: "Who can approve a question?",
    answer:
      "Only accounts with review permission — reviewer and above. Approval and rejection are enforced on the server regardless of what the interface shows, and every decision is attributed and timestamped.",
  },
  {
    question: "Can I import an existing question bank?",
    answer:
      "Yes, up to 500 questions per request, with per-row validation. Rows that fail are reported individually rather than failing the whole batch silently.",
  },
  {
    question: "What formats can a paper be exported to?",
    answer:
      "PDF and DOCX, with student and teacher variants — the teacher variant includes the answer key, gated by the same permission that controls answer visibility elsewhere.",
  },
];

export function FAQ() {
  return (
    <section className="py-20 sm:py-24">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Common questions" align="center" />

        <div className="mt-10 rounded-2xl border border-slate-200 bg-white px-6 sm:px-8">
          {FAQS.map((faq) => (
            <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </Container>
    </section>
  );
}
