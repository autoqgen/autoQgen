import { Container, SectionHeading } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

const STACK = [
  { name: "Next.js", role: "App Router, server components" },
  { name: "TypeScript", role: "End-to-end type safety" },
  { name: "MongoDB", role: "Document storage via Mongoose" },
  { name: "NextAuth.js", role: "Session-based authentication" },
  { name: "Zod", role: "Request & data validation" },
  { name: "Tailwind CSS", role: "Design system utilities" },
];

export function TechStack() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Under the hood"
          title="A stack chosen for correctness, not novelty"
          description="Every request is authenticated, validated and rate-limited before it reaches business logic."
        />

        <RevealGroup className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STACK.map(({ name, role }) => (
            <RevealItem key={name}>
              <div className="flex h-full flex-col justify-center rounded-xl border border-slate-200 bg-white px-5 py-4 transition duration-200 hover:border-slate-300">
                <span className="font-semibold text-slate-900">{name}</span>
                <span className="mt-0.5 text-sm text-slate-500">{role}</span>
              </div>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
