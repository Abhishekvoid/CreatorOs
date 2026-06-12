import type { Metadata } from "next";
import Link from "next/link";
import ProfileForm from "@/components/onboarding/ProfileForm";
import { LogoMark } from "@/components/ui";

export const metadata: Metadata = {
  title: "Set up your profile | CreatorOS",
  description: "Add your photo, headline and bio — and watch your public page take shape live.",
};

const STEPS = ["Handle", "Profile", "Services"];
const CURRENT = 1; // zero-based: profile

export default function OnboardingProfilePage() {
  return (
    <>
      <header className="border-b border-line bg-cream/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between gap-3 px-6">
          <Link href="/" className="group/logo flex items-center gap-2.5 text-[17px] font-black tracking-tight">
            <LogoMark className="size-[30px] rounded-[10px]" />
            <span className="max-sm:hidden">
              Creator<span className="font-medium text-muted">OS</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                {i > 0 && <span className="h-px w-5 bg-line-2 max-sm:w-3" />}
                <span
                  className={`flex items-center gap-1.5 text-[12.5px] font-extrabold ${
                    i === CURRENT ? "text-ink" : i < CURRENT ? "text-green-deep" : "text-faint"
                  }`}
                >
                  <span
                    className={`grid size-5 place-items-center rounded-full text-[10.5px] ${
                      i === CURRENT
                        ? "bg-ink text-cream"
                        : i < CURRENT
                          ? "bg-green-soft text-green-deep"
                          : "border border-line-2 text-faint"
                    }`}
                  >
                    {i < CURRENT ? "✓" : i + 1}
                  </span>
                  <span className="max-sm:hidden">{s}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </header>

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
            <div className="eyebrow">Step 2 · Your profile</div>
            <h1 className="text-[clamp(30px,4vw,42px)] font-black leading-[1.05] tracking-[-0.025em]">
              Introduce yourself{" "}
              <span className="font-serif italic font-normal text-grad">like a pro.</span>
            </h1>
            <p className="mt-3 text-[clamp(15.5px,1.6vw,17px)] font-medium text-muted">
              Everything you type appears on your real page, live on the right. Five fields are enough to go
              live — you can polish the rest anytime.
            </p>
          </div>

          <div className="h-anim" style={{ animationDelay: "0.15s" }}>
            <ProfileForm />
          </div>
        </div>
      </main>
    </>
  );
}
