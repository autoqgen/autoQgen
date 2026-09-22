import { Check, ArrowRight } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { PublicShell } from "@/components/marketing/PublicPage";
import { Container, Eyebrow } from "@/components/marketing/shared";

export const metadata: Metadata = {
	title: "Pricing",
	description: "See the current AutoQgen plan and pricing status.",
};

const INCLUDED_FEATURES = [
	"Question creation and editing",
	"AI question generation",
	"Question review workflow",
	"Searchable question bank",
	"Bulk question import",
	"PDF and DOCX paper export",
];

const PLANNED_PLANS = [
	{
		name: "Creator",
		price: "$9",
		description: "For teachers and individual exam setters who want a faster paper workflow.",
		features: [
			"Everything in Free",
			"AI-assisted question generation",
			"Reusable question-bank workflow",
			"Review-ready paper building",
			"Subject, chapter, and topic organisation",
			"Difficulty and question-type selection",
			"Question editing before approval",
			"Paper preview before export",
		],
		accent: "border-slate-200",
	},
	{
		name: "Studio",
		price: "$19",
		description: "For teams preparing a steady stream of reviewed question papers.",
		features: [
			"Everything in Creator",
			"Bulk question import",
			"Role-based review workflow",
			"PDF and DOCX export",
			"Draft, pending, approved, and rejected states",
			"Duplicate detection during import",
			"Structured paper sections and instructions",
			"Reusable approved questions",
		],
		accent: "border-brand-400 shadow-lg shadow-brand-900/10",
	},
];

export default function PricingPage() {
	return (
		<PublicShell>
			<main id="main">
				<section className="border-b border-slate-200 bg-slate-50/70 py-20 sm:py-24">
					<Container>
						<Eyebrow>Pricing</Eyebrow>
						<h1 className="mt-4 max-w-3xl text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
							Simple access while AutoQgen is getting started
						</h1>
						<p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
							Use the current question-to-paper workflow without a payment step. We are keeping the
							pricing model straightforward until paid plans are ready.
						</p>
					</Container>
				</section>

				<section className="py-16 sm:py-20">
					<Container>
						<div className="grid gap-6 lg:grid-cols-3">
							<article className="relative rounded-2xl border-2 border-brand-500 bg-card p-7 shadow-lg shadow-brand-900/10">
								<span className="absolute right-6 top-6 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-700">
									Available now
								</span>
								<h2 className="text-2xl font-semibold text-slate-900">Free</h2>
								<p className="mt-3 text-sm leading-relaxed text-slate-600">
									Everything currently available in the AutoQgen application.
								</p>
								<div className="mt-6 flex items-end gap-2">
									<span className="text-5xl font-semibold tracking-tight text-slate-900">$0</span>
									<span className="pb-2 text-sm text-slate-500">for now</span>
								</div>
								<ul className="mt-7 flex flex-col gap-3 border-t border-slate-200 pt-6">
									{INCLUDED_FEATURES.map((feature) => (
										<li key={feature} className="flex gap-3 text-sm text-slate-700">
											<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
											{feature}
										</li>
									))}
								</ul>
								<Link
									href="/register"
									className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
								>
									Get started free
									<ArrowRight className="h-4 w-4" />
								</Link>
							</article>

							{PLANNED_PLANS.map((plan) => (
								<article key={plan.name} className={`relative rounded-2xl border bg-card p-7 ${plan.accent}`}>
									<span className="absolute right-6 top-6 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
										Upcoming
									</span>
									<h2 className="text-2xl font-semibold text-slate-900">{plan.name}</h2>
									<p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">{plan.description}</p>
									<div className="mt-6 flex items-end gap-2">
										<span className="text-5xl font-semibold tracking-tight text-slate-900">{plan.price}</span>
										<span className="pb-2 text-sm text-slate-500">per month</span>
									</div>
									<ul className="mt-7 flex flex-col gap-3 border-t border-slate-200 pt-6">
										{plan.features.map((feature) => (
											<li key={feature} className="flex gap-3 text-sm text-slate-700">
												<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
												{feature}
											</li>
										))}
									</ul>
									<p className="mt-7 rounded-lg bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
										Planned for a future release. The displayed price is indicative, and checkout is not active yet.
									</p>
								</article>
							))}
						</div>
					</Container>
				</section>

				<section className="border-t border-slate-200 bg-slate-50 py-14">
					<Container className="flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
						<div>
							<h2 className="text-xl font-semibold text-slate-900">See what is included</h2>
							<p className="mt-2 text-sm text-slate-600">Explore the workflow before creating an account.</p>
						</div>
						<Link href="/features" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-card px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-brand-300 hover:text-brand-700">
							Explore features
							<ArrowRight className="h-4 w-4" />
						</Link>
					</Container>
				</section>
			</main>
		</PublicShell>
	);
}