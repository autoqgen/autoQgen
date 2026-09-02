import { FileClock, Fingerprint, Gauge, Lock } from "lucide-react";
import type { ComponentType } from "react";

import { Container, SectionHeading } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

/**
 * There are no public customer quotes to draw on yet, so trust is earned
 * through concrete, verifiable behaviour instead of invented testimonials.
 */
interface Principle {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  body: string;
}

const PRINCIPLES: Principle[] = [
  {
    icon: Lock,
    title: "Permissions enforced server-side",
    body: "Every route checks the caller's role before touching data — hiding a button in the UI is never the only guard.",
  },
  {
    icon: FileClock,
    title: "A full audit trail",
    body: "Every create, update, delete and status change is logged with who did it and when, kept for two years.",
  },
  {
    icon: Fingerprint,
    title: "Duplicate detection built in",
    body: "A content fingerprint is checked per chapter on every save and every import, so the same question can't quietly land twice.",
  },
  {
    icon: Gauge,
    title: "Rate-limited by design",
    body: "Authentication, imports and reviews are all throttled per account, closing the gaps a busier system tends to leave open.",
  },
];

export function Testimonials() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Why teams trust it"
          title="Built to be correct before it's built to be fast"
          description="No production traction to cite yet — so here is what the system actually does, verifiably, on every request."
        />

        <RevealGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRINCIPLES.map(({ icon: Icon, title, body }) => (
            <RevealItem key={title}>
              <div className="h-full rounded-2xl border border-slate-200 bg-card p-6 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5">
                <div className="inline-flex rounded-lg bg-brand-50 p-2.5 text-brand-700">
                  <Icon aria-hidden className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
