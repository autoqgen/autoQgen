import { CTA } from "@/components/marketing/CTA";
import { CaseStudies } from "@/components/marketing/CaseStudies";
import { FAQ } from "@/components/marketing/FAQ";
import { Hero } from "@/components/marketing/Hero";
import { Industries } from "@/components/marketing/Industries";
import { Services } from "@/components/marketing/Services";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";
import { Stats } from "@/components/marketing/Stats";
import { getOptionalUser } from "@/lib/auth/session";
import { resolveDisplayRole } from "@/lib/auth/role-display";

export default async function HomePage() {
  const user = await getOptionalUser();
  const isLoggedIn = Boolean(user);
  const plainUser = user
    ? { name: user.name, email: user.email, role: user.role, displayRole: await resolveDisplayRole(user) }
    : null;

  return (
    <div className="marketing-site">
      <SiteHeader isLoggedIn={isLoggedIn} user={plainUser} />
      <main id="main">
        <Hero isLoggedIn={isLoggedIn} />
        <Services />
        <CaseStudies />
        <Industries />
        <Stats />
        <FAQ />
        <CTA isLoggedIn={isLoggedIn} />
      </main>
      <SiteFooter isLoggedIn={isLoggedIn} />
    </div>
  );
}
