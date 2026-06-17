"use client";

import { useState } from "react";
import Reveal from "./Reveal";
import { Check } from "./ui";

export default function FinalCta() {
  const [claimed, setClaimed] = useState(false);

  return (
    <section id="final" className="py-[clamp(80px,11vw,130px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <div className="glow-top relative overflow-hidden rounded-[clamp(26px,4vw,44px)] bg-linear-160 from-[#241F16] to-[#191712] to-60% px-[clamp(24px,6vw,90px)] py-[clamp(54px,8vw,100px)] text-center text-cream shadow-pop">
            <h2 className="relative z-1 mb-4.5 text-[clamp(32px,5vw,54px)] font-black leading-[1.08] tracking-tight">
              Your audience is ready to pay you.
              <br />
              <span className="font-serif font-normal italic">Make it effortless.</span>
            </h2>
            <p className="relative z-1 mx-auto mb-9 max-w-[520px] text-[clamp(15.5px,1.8vw,18px)] font-medium text-[#B5B0A4]">
              Claim your link, add your services, and take your first paid booking today — before someone else takes
              your handle.
            </p>
            <form
              className="relative z-1 mx-auto flex max-w-[480px] rounded-full bg-paper p-1.5 shadow-[0_18px_44px_-10px_rgba(0,0,0,.45)] max-md:flex-wrap max-md:gap-1.5 max-md:rounded-[22px]"
              onSubmit={(e) => {
                e.preventDefault();
                setClaimed(true);
              }}
            >
              <span className="flex items-center pl-5 text-[14.5px] font-bold text-faint">creatoros.in/</span>
              <input
                type="text"
                placeholder="yourname"
                aria-label="Choose your handle"
                required
                pattern="[a-zA-Z0-9_-]+"
                className="min-w-0 flex-1 bg-transparent px-1 py-2.5 text-[14.5px] font-bold text-ink outline-none placeholder:text-line-2"
              />
              <button type="submit" className="btn btn-grad !px-6 !py-3 !text-[14.5px] max-md:w-full">
                {claimed ? (
                  <span className="inline-flex items-center gap-1.5">Link reserved <Check className="size-4 text-current" /></span>
                ) : (
                  "Claim free link"
                )}
              </button>
            </form>
            <div className="relative z-1 mt-4.5 text-[13px] font-semibold text-[#8E897D]">
              Free forever plan · 0% commission · set up in 5 minutes
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
