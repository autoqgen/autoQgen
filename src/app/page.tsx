import { CTA } from "@/components/marketing/CTA";
import { CaseStudies } from "@/components/marketing/CaseStudies";
import { FAQ } from "@/components/marketing/FAQ";
import { Hero } from "@/components/marketing/Hero";
import { Industries } from "@/components/marketing/Industries";
import { Portfolio } from "@/components/marketing/Portfolio";
import { Process } from "@/components/marketing/Process";
import { Services } from "@/components/marketing/Services";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";
import { Stats } from "@/components/marketing/Stats";
import { TechStack } from "@/components/marketing/TechStack";
import { Testimonials } from "@/components/marketing/Testimonials";
import { TrustedCompanies } from "@/components/marketing/TrustedCompanies";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <TrustedCompanies />
        <Services />
        <Industries />
        <Portfolio />
        <CaseStudies />
        <TechStack />
        <Process />
        <Stats />
        <Testimonials />
        <FAQ />
        <CTA />
      </main>
      <SiteFooter />
    </>
  );
}
