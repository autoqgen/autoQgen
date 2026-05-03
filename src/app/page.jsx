import WhyUs from "@/components/WhyUs";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";

import Hero from "@/components/Hero";
export default function Home() {
  return (
    <main className="bg-gray-50">
      <Hero />
      <WhyUs />
      <HowItWorks />
      <Testimonials />
      <FAQ />
      
    </main>
  );
}
