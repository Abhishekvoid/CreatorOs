import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AvailabilityForm from "@/components/onboarding/AvailabilityForm";
import WizardHeader from "@/components/onboarding/WizardHeader";
import { getAvailability } from "@/lib/actions/availability";
import { getProfileDraft } from "@/lib/actions/profile";
import { getServiceDraft } from "@/lib/actions/service";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Set your availability | CreatorOS",
  description: "Pick your weekly hours — bookable slots appear on your page instantly.",
};

export default async function OnboardingAvailabilityPage() {
  const [profile, service, availability] = await Promise.all([
    getProfileDraft(),
    getServiceDraft(),
    getAvailability(),
  ]);

  if (isSupabaseConfigured && !profile.handle) redirect("/onboarding/handle");

  return (
    <>
      <WizardHeader current={3} />

      <main data-register="product" className="relative overflow-hidden">
        {/* same ambient wash family as the rest of the product */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(800px 420px at 90% 0%, rgba(242,163,60,.10), transparent 60%), radial-gradient(640px 400px at 0% 30%, rgba(226,85,44,.06), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1240px] px-6 pb-[clamp(80px,10vw,140px)] pt-[clamp(40px,6vw,72px)]">
          <div className="h-anim mb-10 max-w-[560px]" style={{ animationDelay: "0.05s" }}>
            <div className="eyebrow">Step 4 · Availability</div>
            <h1 className="text-[clamp(30px,4vw,42px)] font-black leading-[1.05] tracking-[-0.025em]">
              When can clients{" "}
              <span className="font-serif italic font-normal text-grad">book you?</span>
            </h1>
            <p className="mt-3 text-[clamp(15.5px,1.6vw,17px)] font-medium text-muted">
              A weekly rhythm is all you need. Your next bookable slots appear on the page preview
              as you set it.
            </p>
          </div>

          <div className="h-anim" style={{ animationDelay: "0.15s" }}>
            <AvailabilityForm initial={availability} profile={profile} service={service} />
          </div>
        </div>
      </main>
    </>
  );
}
