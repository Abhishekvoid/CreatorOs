import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PaymentSetupCard from "@/components/onboarding/payments/PaymentSetupCard";
import WizardHeader from "@/components/onboarding/WizardHeader";
import { getPaymentProfile } from "@/lib/actions/payment-profile";
import { getProfileDraft } from "@/lib/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "Payments | CreatorOS",
  description: "Set up payouts and publish your page — client payments work today.",
};

/**
 * Step 5 · Payments — the Payment Setup experience and the final onboarding
 * step. It tells the truth about payouts (being prepared, not live) and carries
 * the Publish CTA, so publishing is never gated on payouts. This is also the
 * step a returning, unpublished creator resumes on (destinationFor in lib/auth).
 */
export default async function OnboardingPaymentsPage() {
  const [profile, paymentProfile] = await Promise.all([
    getProfileDraft(),
    getPaymentProfile(),
  ]);

  if (isSupabaseConfigured && !profile.handle) redirect("/onboarding/handle");

  return (
    <>
      <WizardHeader current={4} />

      <main data-register="product" className="relative overflow-hidden">
        {/* same ambient wash family as the rest of the product */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(800px 420px at 90% 0%, rgba(242,163,60,.10), transparent 60%), radial-gradient(640px 400px at 0% 30%, rgba(226,85,44,.06), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-[1080px] px-6 pb-[clamp(80px,10vw,140px)] pt-[clamp(40px,6vw,72px)]">
          <div className="h-anim mb-10 max-w-[600px]" style={{ animationDelay: "0.05s" }}>
            <div className="eyebrow">Step 5 · Payments</div>
            <h1 className="text-[clamp(30px,4vw,42px)] font-black leading-[1.05] tracking-[-0.025em]">
              Get ready to{" "}
              <span className="font-serif italic font-normal text-grad">get paid.</span>
            </h1>
            <p className="mt-3 text-[clamp(15.5px,1.6vw,17px)] font-medium text-muted">
              Your booking page already takes client payments. Direct creator payouts are being
              prepared — publish now and you can switch them on the moment they launch.
            </p>
          </div>

          <div className="h-anim" style={{ animationDelay: "0.15s" }}>
            <PaymentSetupCard profile={paymentProfile} />
          </div>
        </div>
      </main>
    </>
  );
}
