import FinalCta from "@/components/FinalCta";
import Features from "@/components/Features";
import Footer from "@/components/Footer";
import Hero from "@/components/Hero";
import HowItWorks from "@/components/HowItWorks";
import Marquee from "@/components/Marquee";
import Nav from "@/components/Nav";
import Pricing from "@/components/Pricing";
import Replace from "@/components/Replace";
import Reveal from "@/components/Reveal";
import Showcase from "@/components/Showcase";
import Testimonials from "@/components/Testimonials";
import { SectionHead } from "@/components/ui";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Replace />
        <Features />
        <HowItWorks />

        <section id="product" className="py-[clamp(72px,10vw,120px)]">
          <div className="mx-auto max-w-[1160px] px-6">
            <Reveal>
              <SectionHead
                eyebrow="Inside the product"
                title={
                  <>
                    A closer look at <span className="font-serif italic font-normal">your new front office.</span>
                  </>
                }
                sub="The page your clients see, and the dashboard only you do."
              />
            </Reveal>
            <Reveal>
              <Showcase />
            </Reveal>
          </div>
        </section>

        <Testimonials />
        <Pricing />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
