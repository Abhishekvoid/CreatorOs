import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ServiceForm from "@/components/onboarding/ServiceForm";
import WizardHeader from "@/components/onboarding/WizardHeader";
import { getProfileDraft } from "@/lib/actions/profile";
import { getServiceDraft } from "@/lib/actions/service";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Your first service | CreatorOS",
  description: "Set up the session clients will book — and watch the real card take shape live.",
};

export default async function OnboardingServicePage() {
  const [profile, service] = await Promise.all([getProfileDraft(), getServiceDraft()]);

  // No handle means no profiles row — this creator hasn't claimed yet.
  if (isSupabaseConfigured && !profile.handle) redirect("/onboarding/handle");

  return (
    <>
      <WizardHeader current={2} />

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
            <div className="eyebrow">Step 3 · Your first service</div>
            <h1 className="text-[clamp(30px,4vw,42px)] font-black leading-[1.05] tracking-[-0.025em]">
              What will clients{" "}
              <span className="font-serif italic font-normal text-grad">book you for?</span>
            </h1>
            <p className="mt-3 text-[clamp(15.5px,1.6vw,17px)] font-medium text-muted">
              One service is enough to go live. The card on the right is the real one from your
              public page — exactly what clients will see.
            </p>
          </div>

          <div className="h-anim" style={{ animationDelay: "0.15s" }}>
            <ServiceForm initial={service} handle={profile.handle || "you"} />
          </div>
        </div>
      </main>
    </>
  );
}
