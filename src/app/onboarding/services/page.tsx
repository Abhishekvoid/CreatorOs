import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Add your first service | CreatorOS",
  description: "Step 3 of onboarding — create the first thing clients can book.",
};

/**
 * Placeholder for onboarding step 3. The profile step routes here on
 * Continue; the services builder is the next milestone.
 */
export default function OnboardingServicesPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(720px 420px at 50% 0%, rgba(23,138,91,.08), transparent 60%), radial-gradient(640px 400px at 85% 40%, rgba(242,163,60,.08), transparent 60%)",
        }}
      />
      <div className="relative max-w-[480px] text-center">
        <div className="check-pop mx-auto grid size-16 place-items-center rounded-full bg-green-soft">
          <svg viewBox="0 0 24 24" fill="none" stroke="#178a5b" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="size-7" aria-hidden="true">
            <path className="check-draw" d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <h1 className="h-anim mt-6 text-[clamp(28px,4vw,38px)] font-black leading-[1.05] tracking-[-0.025em]" style={{ animationDelay: "0.15s" }}>
          Profile saved. <span className="font-serif italic font-normal text-grad">Looking sharp.</span>
        </h1>
        <p className="h-anim mt-3 text-[16px] font-medium text-muted" style={{ animationDelay: "0.25s" }}>
          Next up: your first bookable service — pricing, duration and availability. This step is being built;
          your profile is safe and you can come back to edit it anytime.
        </p>
        <div className="h-anim mt-8 flex flex-wrap justify-center gap-3" style={{ animationDelay: "0.35s" }}>
          <Link href="/onboarding/profile" className="btn btn-ghost">
            Back to profile
          </Link>
          <Link href="/" className="group/logo btn btn-primary">
            <LogoMark className="size-[22px] rounded-[7px]" /> Back home
          </Link>
        </div>
      </div>
    </main>
  );
}
