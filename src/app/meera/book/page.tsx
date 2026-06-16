/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { Star } from "lucide-react";
import BookingFlow from "@/components/booking/BookingFlow";
import CheckoutNav from "@/components/booking/CheckoutNav";
import DemoBanner from "@/components/DemoBanner";
import Faq from "@/components/profile/Faq";
import { MEERA_AVATAR } from "@/components/persona";
import Reveal from "@/components/Reveal";
import { LogoMark, VerifiedBadge } from "@/components/ui";

export const metadata: Metadata = {
  title: "Book a 1:1 Career Strategy Call with Meera Shah | CreatorOS",
  description:
    "Pick a slot, pay via UPI and get instant confirmation on WhatsApp. 45-minute career strategy call with Meera Shah — rated 4.9 from 212 reviews.",
};

const BOOKING_FAQ = [
  {
    q: "What happens after booking?",
    a: "Payment confirms your slot instantly — no approval step. Within seconds you'll get a WhatsApp message and email with your Google Meet link, a calendar invite, and a short intake summary so Meera arrives prepared.",
  },
  {
    q: "Can I reschedule?",
    a: "Yes — once, free, up to 24 hours before the session. There's a one-tap reschedule link inside your WhatsApp confirmation; you'll see the same calendar you used here and can pick any open slot.",
  },
  {
    q: "Do I get a recording?",
    a: "Every call is recorded (with your consent) and shared within 24 hours, along with Meera's written notes and the action plan you agreed on.",
  },
  {
    q: "What is the refund policy?",
    a: "If your first session isn't worth it, say so within 24 hours and you'll get a 100% refund to the original payment method — no questions, no forms. Refunds typically land in 5–7 business days.",
  },
  {
    q: "How do I join the session?",
    a: "Tap the Google Meet link in your confirmation — it works in the browser or app, on phone or laptop, no account needed. Join from a quiet place with your resume handy.",
  },
  {
    q: "When will I receive the meeting link?",
    a: "Immediately after payment, on both WhatsApp and email. You'll also get reminder nudges 24 hours and 1 hour before the session with the same link.",
  },
];

export default function BookingPage() {
  return (
    <>
      <DemoBanner />
      <CheckoutNav />
      <main data-register="product" className="pb-24 lg:pb-0">
        <div className="relative overflow-hidden">
          {/* ambient wash, same family as the profile header */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(800px 420px at 85% 0%, rgba(242,163,60,.10), transparent 60%), radial-gradient(640px 400px at 5% 18%, rgba(226,85,44,.06), transparent 60%)",
            }}
          />

          <div className="relative mx-auto max-w-[1160px] px-6 pb-[clamp(56px,7vw,88px)] pt-[140px]">
            {/* creator context */}
            <div className="h-anim mb-7 flex flex-wrap items-center gap-x-5 gap-y-4" style={{ animationDelay: "0.05s" }}>
              <img
                src={MEERA_AVATAR}
                alt="Meera Shah, career coach"
                className="size-[68px] rounded-full border-[3px] border-white object-cover shadow-card outline outline-2 outline-offset-2 outline-terra"
              />
              <div className="min-w-0">
                <h1 className="flex items-center gap-2 text-[clamp(22px,2.8vw,28px)] font-black tracking-[-0.02em]">
                  Book with Meera Shah <VerifiedBadge />
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] font-semibold text-muted">
                  <span className="font-bold text-ink-2">Career Coach</span>
                  <span>
                    <Star className="inline size-3 align-[-1px] text-amber" fill="currentColor" strokeWidth={0} aria-hidden="true" /> <b className="text-ink">4.9</b> (212 reviews)
                  </span>
                  <span>
                    <b className="text-ink">340+</b> sessions
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-[7px] rounded-full bg-green animate-pulse-dot" />
                    Replies within 2 hours
                  </span>
                  <span>English · Hindi</span>
                </div>
              </div>
            </div>

            <div className="h-anim" style={{ animationDelay: "0.18s" }}>
              <BookingFlow />
            </div>
          </div>
        </div>

        {/* FAQ */}
        <section className="border-t border-line bg-paper py-[clamp(56px,8vw,96px)]">
          <div className="mx-auto max-w-[1160px] px-6">
            <Reveal>
              <div className="mb-[clamp(32px,5vw,48px)] text-center">
                <h2 className="text-[clamp(26px,3.6vw,38px)] font-bold leading-[1.1] tracking-[-0.025em]">
                  Before you pay, <span className="font-serif italic font-normal text-grad">anything unclear?</span>
                </h2>
              </div>
            </Reveal>
            <Reveal>
              <Faq items={BOOKING_FAQ} />
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-paper py-6">
        <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-3 px-6 max-md:justify-center">
          <Link href="/" className="group/logo flex items-center gap-2 text-[13px] font-bold text-muted transition-colors hover:text-ink">
            <LogoMark className="size-[20px] rounded-[7px]" />
            Powered by CreatorOS
          </Link>
          <p className="text-[12.5px] font-semibold text-faint">
            Payments secured by Razorpay · Your details are shared only with Meera
          </p>
        </div>
        <div className="h-16 lg:hidden" aria-hidden="true" />
      </footer>
    </>
  );
}
