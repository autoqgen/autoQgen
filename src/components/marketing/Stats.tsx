import { Container } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

/**
 * Product facts, not usage metrics — there is no invented "10,000+ users"
 * counter here, only what the system genuinely supports.
 */
const FACTS = [
  { value: "10", label: "Question types supported" },
  { value: "4", label: "Stage review pipeline" },
  { value: "8", label: "Permission-scoped roles" },
  { value: "2", label: "Export formats — PDF & DOCX" },
];

export function Stats() {
  return (
    <section className="border-y border-slate-200 bg-slate-900 py-16 sm:py-20 dark:bg-ink">
      <Container>
        <RevealGroup className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {FACTS.map(({ value, label }) => (
            <RevealItem key={label} className="text-center">
              <div className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                {value}
              </div>
              <p className="mt-2 text-sm text-slate-400">{label}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
