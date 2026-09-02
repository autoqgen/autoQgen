import { GraduationCap, PenSquare, ShieldCheck, UserCog } from "lucide-react";
import type { ComponentType } from "react";

import { Container, SectionHeading } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

interface Audience {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  role: string;
  body: string;
}

const AUDIENCES: Audience[] = [
  {
    icon: PenSquare,
    role: "Content writers",
    body: "Draft questions against a fixed taxonomy, submit for review, and track every decision on their own work.",
  },
  {
    icon: GraduationCap,
    role: "Teachers",
    body: "Reuse an approved bank across classes, then generate and export a paper for a specific chapter set in minutes.",
  },
  {
    icon: ShieldCheck,
    role: "Reviewers & moderators",
    body: "Work a dedicated queue, approve or reject with a note, and clear a backlog in bulk instead of one at a time.",
  },
  {
    icon: UserCog,
    role: "Admins & owners",
    body: "Manage taxonomy, roles and the audit trail, with full visibility across every subject and every submission.",
  },
];

export function Industries() {
  return (
    <section className="bg-slate-50 py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Who it's for"
          title="One system, four roles, no permission guesswork"
          description="Access is scoped by role at both the API and the UI, so what someone can do never depends on what a button happens to hide."
        />

        <RevealGroup className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map(({ icon: Icon, role, body }) => (
            <RevealItem key={role}>
              <article className="h-full rounded-2xl border border-slate-200 bg-card p-6 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md hover:shadow-slate-900/5">
                <div className="inline-flex rounded-lg bg-brand-50 p-2.5 text-brand-700">
                  <Icon aria-hidden className="h-5 w-5" />
                </div>
                <h3 className="mt-4 font-semibold text-slate-900">{role}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{body}</p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
