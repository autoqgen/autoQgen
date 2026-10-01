import type { Metadata } from "next";

import { FeaturesLayout } from "@/components/marketing/MarketingLayouts";
import { PublicShell } from "@/components/marketing/PublicPage";

export const metadata: Metadata = { title: "Features", description: "Explore the question generation, review, question bank, paper, import, export, and access features in AutoQgen." };

export default function FeaturesPage() {
	return <PublicShell><FeaturesLayout /></PublicShell>;
}