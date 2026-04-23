
import WhyUs from "@/components/WhyUs";
import HowItWorks from "@/components/HowItWorks";
import Testimonials from "@/components/Testimonials";
import FAQ from "@/components/FAQ";
import Footer from "@/components/Footer";


export default function Home() {
  return (
    <main className="bg-gray-50">

      <WhyUs />
      <HowItWorks />
      <Testimonials />
      <FAQ />
    <Footer />
    </main>
  );
}