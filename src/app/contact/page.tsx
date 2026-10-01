import type { Metadata } from "next";
import { ContactLayout } from "@/components/marketing/MarketingLayouts";
import { PublicShell } from "@/components/marketing/PublicPage";
export const metadata: Metadata = { title: "Contact", description: "Find the right next step for questions about AutoQgen." };
export default function ContactPage() { return <PublicShell><ContactLayout /></PublicShell>; }