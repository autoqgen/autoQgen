import type { Metadata } from "next";
import { ResourcesLayout } from "@/components/marketing/MarketingLayouts";
import { PublicShell } from "@/components/marketing/PublicPage";
export const metadata: Metadata = { title: "Resources", description: "Guides, documentation, examples, FAQs, and product updates for AutoQgen." };
export default function ResourcesPage() { return <PublicShell><ResourcesLayout /></PublicShell>; }