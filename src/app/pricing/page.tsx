import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { PublicShell } from "@/components/marketing/PublicPage";
import { Container, MarketingCard, PageHeader } from "@/components/marketing/shared";
import { FAQ } from "@/components/marketing/FAQ";

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
				<PageHeader
					eyebrow="Pricing"
					title="Simple access while AutoQgen is getting started"
					description="Use the current question-to-paper workflow without a payment step. We are keeping the pricing model straightforward until paid plans are ready."
					actions={
						<>
							<Link href="/register" className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_35px_-18px_rgba(124,58,237,0.9)] transition hover:bg-brand-700">
								Get started free
								<ArrowRight className="h-4 w-4" />
							</Link>
							<Link href="/features" className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-brand-300 hover:text-brand-700">
								Explore features
							</Link>
						</>
					}
				/>

				<section className="py-16 sm:py-20">
					<Container>
						<div className="grid gap-6 lg:grid-cols-3">
							<MarketingCard className="relative border-2 border-brand-500 shadow-[0_28px_60px_-30px_rgba(124,58,237,0.6)]">
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
							</MarketingCard>

							{PLANNED_PLANS.map((plan) => (
								<MarketingCard key={plan.name} className={`relative ${plan.accent}`}>
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
								</MarketingCard>
							))}
						</div>
					</Container>
				</section>

				<section className="border-t border-slate-200 py-16 sm:py-20">
					<Container>
						<div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
							<div>
								<p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-700">Compare the workflow</p>
								<h2 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-slate-900">What is available now, and what is planned</h2>
							</div>
							<p className="max-w-sm text-sm leading-relaxed text-slate-600">Paid checkout is not active yet, so the comparison stays explicit instead of implying features or billing that are not available.</p>
						</div>
						<div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200">
							<table className="min-w-[640px] w-full border-collapse text-left text-sm">
								<thead className="bg-slate-50 text-slate-900">
									<tr><th className="px-5 py-4 font-semibold">Workflow capability</th><th className="px-5 py-4 font-semibold">Free</th><th className="px-5 py-4 font-semibold">Creator</th><th className="px-5 py-4 font-semibold">Studio</th></tr>
								</thead>
								<tbody className="divide-y divide-slate-200 bg-white text-slate-700">
									{["Create and edit questions", "AI question generation", "Review states and approval", "Searchable question bank", "Bulk import and duplicate checks", "PDF and DOCX export"].map((feature, index) => <tr key={feature}><td className="px-5 py-4 font-medium">{feature}</td><td className="px-5 py-4 text-emerald-600">{index < 4 ? "Included" : "Current workflow"}</td><td className="px-5 py-4 text-amber-700">Planned</td><td className="px-5 py-4 text-amber-700">Planned</td></tr>)}
								</tbody>
							</table>
						</div>
					</Container>
				</section>

				<FAQ />

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