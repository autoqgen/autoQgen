import { Container } from "@/components/marketing/shared";

/**
 * There are no public customer logos to show yet, so this bar earns trust
 * honestly: the concrete foundations the product is built on, not invented
 * client names.
 */
const FOUNDATIONS = [
  "Next.js",
  "TypeScript",
  "MongoDB",
  "NextAuth.js",
  "Zod",
  "Tailwind CSS",
];

export function TrustedCompanies() {
  return (
    <section className="border-y border-slate-200 bg-card py-10">
      <Container>
        <p className="text-center text-xs font-medium tracking-wide text-slate-500 uppercase">
          Built on a production-grade foundation
        </p>
        <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {FOUNDATIONS.map((name) => (
            <li key={name} className="text-sm font-semibold text-slate-400 transition hover:text-slate-600">
              {name}
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
