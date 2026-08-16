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
import { getOptionalUser } from "@/lib/auth/session";

export default async function HomePage() {
  const user = await getOptionalUser();
  const isLoggedIn = Boolean(user);
  const plainUser = user ? { name: user.name, email: user.email, role: user.role } : null;

  return (
    <>
      <SiteHeader isLoggedIn={isLoggedIn} user={plainUser} />
      <main id="main">
        <Hero isLoggedIn={isLoggedIn} />
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
        <CTA isLoggedIn={isLoggedIn} />
      </main>
      <SiteFooter isLoggedIn={isLoggedIn} />
    </>
  );
}
