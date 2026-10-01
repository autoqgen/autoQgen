import { Container, SectionHeading } from "@/components/marketing/shared";
import { FaqItem } from "@/components/marketing/FaqItem";

const FAQS = [
  {
    question: "Can I keep Bangla and English questions in the same bank?",
    answer:
      "Yes. The question schema stores `bn` or `en` on each question, so both languages can be stored and filtered in the same organization-scoped bank.",
  },
  {
    question: "What happens after an AI question is generated?",
    answer:
      "The generator returns candidates marked new, duplicate, or needs review. You can edit or remove candidates, select valid new ones, and import the selection into the Question Bank as drafts.",
  },
  {
    question: "Which question types can AutoQgen generate?",
    answer:
      "Standard AI generation supports MCQ, multiple correct, true/false, short answer, written, and fill-in-the-blank. A separate Creative Question endpoint generates four-part creative questions. The question form stores ten types, including matching, assertion-reason, image, and passage questions.",
  },
  {
    question: "Can I import an existing question bank?",
    answer:
      "Yes. Upload a CSV or JSON file with 1–500 questions per request. Each row is validated against the taxonomy and answer rules; failed rows are returned with their row errors.",
  },
  {
    question: "How is a duplicate question detected?",
    answer:
      "AutoQgen normalizes the question text, combines it with the chapter, and stores a content hash. The existing organization bank is checked on create and import, so the same normalized question cannot be stored twice in that chapter.",
  },
  {
    question: "Who can approve or bulk-review questions?",
    answer:
      "The `question:review` capability is required; an active organization membership can provide the same organization-scoped capability. The server checks it for individual decisions and for bulk review, which accepts up to 200 selected question IDs.",
  },
  {
    question: "What formats can a paper be exported to?",
    answer:
      "Papers export as PDF or DOCX, and each format has a student and teacher copy. The teacher copy is the answer-including variant; the student copy omits answers.",
  },
  {
    question: "Can I compare similar questions before finalizing a paper?",
    answer:
      "Yes. Similarity review checks question pairs within the current paper, flags candidates using embeddings plus semantic validation, and lets the permitted user keep both or replace a flagged question.",
  },
];

export function FAQ() {
  return (
    <section className="py-20 sm:py-24">
      <Container className="max-w-3xl">
        <SectionHeading eyebrow="FAQ" title="Common questions" align="center" />

        <div className="mt-10 rounded-2xl border border-slate-200 bg-card px-6 sm:px-8">
          {FAQS.map((faq) => (
            <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </Container>
    </section>
  );
}
