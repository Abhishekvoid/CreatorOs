"use client";

import confetti from "canvas-confetti";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getProfileDraft } from "@/lib/actions/profile";
import { slugify } from "@/lib/creator";

/**
 * The publish signature moment — one of exactly two theatrical moments in
 * the product. The live URL types itself on (600ms staggered characters),
 * one soft confetti burst fires (saffron + ivory + green, ~1.5s, once ever
 * per creator), then the WhatsApp share button breathes a single pulse.
 * Reduced motion: static URL + buttons, no confetti.
 */

const CONFETTI_KEY = "creatoros.publish.confetti";
const BRAND_COLORS = ["#c64c23", "#faf7f3", "#158561"];

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function PublishMoment({ handle: serverHandle }: { handle?: string }) {
  const [handle, setHandle] = useState<string | null>(serverHandle ?? null);
  const [copied, setCopied] = useState(false);
  const [staticReveal, setStaticReveal] = useState(false);

  useEffect(() => {
    // The published handle is the source of truth and arrives as a prop from
    // the server. Only when it's absent (local dev without Supabase) do we fall
    // back to the draft, deriving a best-effort handle from the name.
    const resolve = serverHandle
      ? Promise.resolve(serverHandle)
      : getProfileDraft().then((d) => d.handle || slugify(d.name) || "you");

    resolve.then((resolved) => {
      setHandle(resolved);
      if (reducedMotion()) {
        setStaticReveal(true);
        return; // no confetti, no choreography
      }
      // once ever per creator — never on revisit
      if (!localStorage.getItem(CONFETTI_KEY)) {
        localStorage.setItem(CONFETTI_KEY, "1");
        const end = Date.now() + 1500;
        const burst = () => {
          confetti({
            particleCount: 24,
            spread: 70,
            startVelocity: 28,
            scalar: 0.9,
            origin: { y: 0.45 },
            colors: BRAND_COLORS,
            disableForReducedMotion: true,
          });
          if (Date.now() < end) setTimeout(burst, 250);
        };
        setTimeout(burst, 650); // after the URL finishes typing on
      }
    });
  }, [serverHandle]);

  const url = `creatoros.in/${handle ?? ""}`;
  const chars = url.split("");

  async function copyLink() {
    await navigator.clipboard.writeText(`https://${url}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative mx-auto max-w-[640px] px-6 text-center">
      <div className="text-[12.5px] font-semibold uppercase tracking-[0.08em] text-terra-deep">
        Your page is live
      </div>

      {/* the live URL is the hero — wraps only between domain and handle */}
      <h1 className="mt-5 text-[clamp(28px,5vw,52px)] font-bold leading-[1.1] tracking-[-0.02em]">
        {handle === null ? (
          <span className="opacity-0">creatoros.in/you</span>
        ) : staticReveal ? (
          <>
            <span className="whitespace-nowrap text-faint">creatoros.in/</span>
            <span className="whitespace-nowrap">{handle}</span>
          </>
        ) : (
          ["creatoros.in/", handle].map((segment, s) => (
            <span key={s} className="inline-block whitespace-nowrap">
              {segment.split("").map((c, i) => {
                const globalIndex = s === 0 ? i : 13 + i;
                return (
                  <span
                    key={`${c}-${i}`}
                    className={`type-on inline-block ${s === 0 ? "text-faint" : ""}`}
                    style={{ animationDelay: `${(globalIndex * 600) / chars.length}ms` }}
                  >
                    {c}
                  </span>
                );
              })}
            </span>
          ))
        )}
      </h1>

      <p className="mx-auto mt-4 max-w-[44ch] text-[16px] font-medium text-muted">
        Your page is ready to earn. Share it once on WhatsApp — that&rsquo;s where your first booking
        usually comes from.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Book a session with me here: https://${url}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`btn btn-grad btn-lg ${staticReveal ? "" : "breathe-once"}`}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="size-[18px]" aria-hidden="true">
            <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.7.9c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4 0-.5.1-.7l.4-.5c.1-.2.1-.4 0-.5l-.8-1.8c-.2-.5-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 1.9s.8 2.2 1 2.4c.1.2 1.7 2.6 4.1 3.6 2.4 1 2.4.7 2.9.6.4 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2 0 0-.2-.1-.4-.2z" />
          </svg>
          Share on WhatsApp
        </a>
        <button
          type="button"
          onClick={copyLink}
          className={`btn btn-ghost btn-lg transition-colors duration-150 ${copied ? "!bg-cream-2" : ""}`}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        {handle && (
          <a href={`/${handle}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-lg">
            View profile
          </a>
        )}
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] font-semibold">
        <Link href="/dashboard" className="text-ink-2 underline-offset-4 transition-colors hover:text-ink hover:underline">
          Go to your dashboard →
        </Link>
        <Link href="/onboarding/profile" className="text-muted underline-offset-4 transition-colors hover:text-ink hover:underline">
          Keep editing your profile
        </Link>
      </div>

      <p className="mt-12 text-[12.5px] font-medium text-faint">
        Next: add your first bookable service — pricing, duration and availability.
      </p>
    </div>
  );
}
