import type { Metadata } from "next";
import DemoBanner from "@/components/DemoBanner";
import Reveal from "@/components/Reveal";
import { SectionHead } from "@/components/ui";
import Faq from "@/components/profile/Faq";
import ProfileCta from "@/components/profile/ProfileCta";
import ProfileFooter from "@/components/profile/ProfileFooter";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileNav from "@/components/profile/ProfileNav";
import ProfileTestimonials from "@/components/profile/ProfileTestimonials";
import Products from "@/components/profile/Products";
import Results from "@/components/profile/Results";
import Services from "@/components/profile/Services";
import StickyCta from "@/components/profile/StickyCta";
import TrustStrip from "@/components/profile/TrustStrip";

export const metadata: Metadata = {
  title: "Meera Shah — Career Coach · Book a session | CreatorOS",
  description:
    "Book a 1:1 career strategy call, resume review or mock interview with Meera Shah. 340+ sessions, rated 4.9, 120+ clients helped. Pay via UPI, instant confirmation.",
};

export default function MeeraProfile() {
  return (
    <>
      <DemoBanner />
      <ProfileNav />
      <main>
        <ProfileHeader />
        <TrustStrip />
        <Services />
        <Products />
        <Results />
        <ProfileTestimonials />

        <section id="faq" className="border-t border-line bg-paper py-[clamp(64px,9vw,110px)]">
          <div className="mx-auto max-w-[1160px] px-6">
            <Reveal>
              <SectionHead
                center
                eyebrow="Before you book"
                title={
                  <>
                    Questions, <span className="font-serif italic font-normal text-grad">answered.</span>
                  </>
                }
                sub="Everything clients usually ask before their first session."
              />
            </Reveal>
            <Reveal>
              <Faq />
            </Reveal>
          </div>
        </section>

        <div className="pt-[clamp(64px,9vw,110px)]">
          <ProfileCta />
        </div>
      </main>
      <ProfileFooter />
      <StickyCta />
    </>
  );
}
