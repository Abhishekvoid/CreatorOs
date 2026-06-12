import type { Metadata } from "next";
import Link from "next/link";
import WizardHeader from "@/components/onboarding/WizardHeader";

export const metadata: Metadata = {
  title: "Payments | CreatorOS",
  description: "Connect payments so booking money lands directly with you.",
};

/**
 * Step 5 placeholder — the payments setup (Razorpay keys, GST) is the next
 * build. This stub keeps the wizard chain unbroken so Continue from
 * availability never dead-ends.
 */
export default function OnboardingPaymentsPage() {
  return (
    <>
      <WizardHeader current={4} />
      <main data-register="product" className="grid min-h-[70vh] place-items-center px-6 py-16">
        <div className="max-w-[440px] text-center">
          <div className="eyebrow justify-center">Step 5 · Payments</div>
          <h1 className="text-[clamp(28px,4vw,38px)] font-black leading-[1.1] tracking-[-0.025em]">
            Payments setup{" "}
            <span className="font-serif italic font-normal text-grad">arrives here next.</span>
          </h1>
          <p className="mt-3 text-[15.5px] font-medium text-muted">
            This step is still being built. Your services and availability are saved — nothing is
            lost.
          </p>
          <Link href="/dashboard" className="btn btn-ghost mt-7">
            Back to dashboard
          </Link>
        </div>
      </main>
    </>
  );
}
