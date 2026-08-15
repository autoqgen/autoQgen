import Link from "next/link";

import { Container } from "@/components/marketing/shared";
import { RevealGroup, RevealItem } from "@/components/marketing/Reveal";

export function CTA() {
  return (
    <section className="py-20 sm:py-24">
      <Container className="max-w-2xl">
        <RevealGroup className="rounded-3xl border border-slate-200 bg-white px-8 py-14 text-center shadow-sm">
          <RevealItem>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Start organising your question bank today
            </h2>
          </RevealItem>
          <RevealItem>
            <p className="mx-auto mt-3 max-w-md text-base text-slate-600">
              Free to create an account. Add your first questions in minutes.
            </p>
          </RevealItem>
          <RevealItem>
            <Link
              href="/register"
              className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700"
            >
              Create an account
            </Link>
          </RevealItem>
        </RevealGroup>
      </Container>
    </section>
  );
}
