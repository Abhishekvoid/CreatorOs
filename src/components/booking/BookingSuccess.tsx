"use client";

/* eslint-disable @next/next/no-img-element */
import { VerifiedBadge } from "../ui";

const MEET_LINK = "https://meet.google.com/kzr-vqpd-hub";

const SENT = ["WhatsApp confirmation sent", "Calendar invite sent", "Confirmation email sent"];

export default function BookingSuccess({ d, t, id = "CR-DEMO42" }: { d?: string; t?: string; id?: string }) {
  const dateLabel = d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  return (
    <div className="mx-auto max-w-[560px] px-6 pb-[clamp(64px,9vw,110px)] pt-[clamp(72px,10vw,110px)] text-center">
      {/* animated check */}
      <div className="check-pop mx-auto grid size-[88px] place-items-center rounded-full bg-green shadow-[0_18px_44px_-12px_rgba(23,138,91,.55)]">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" className="size-11" aria-hidden="true">
          <path className="check-draw" d="M20 6L9 17l-5-5" />
        </svg>
      </div>

      <h1 className="h-anim mt-7 text-[clamp(30px,4.4vw,42px)] font-black leading-[1.08] tracking-[-0.025em]" style={{ animationDelay: "0.2s" }}>
        Booking confirmed.
        <br />
        <span className="font-serif italic font-normal text-grad">See you there.</span>
      </h1>
      <p className="h-anim mt-3.5 text-[15.5px] font-medium text-muted" style={{ animationDelay: "0.3s" }}>
        Your 1:1 Career Strategy Call with Meera Shah is locked in.
      </p>

      {/* booking details */}
      <div className="h-anim mt-8 overflow-hidden rounded-[26px] border border-line bg-paper text-left shadow-card" style={{ animationDelay: "0.4s" }}>
        <div className="flex items-center gap-3 border-b border-line bg-cream px-6 py-4">
          <img
            src="https://randomuser.me/api/portraits/women/68.jpg"
            alt="Meera Shah"
            className="size-11 rounded-full border-2 border-white object-cover outline outline-[1.5px] outline-offset-1 outline-terra"
          />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[15px] font-extrabold tracking-tight">
              Meera Shah <VerifiedBadge />
            </div>
            <div className="truncate text-[12px] font-semibold text-muted">1:1 Career Strategy Call · 45 min</div>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-extrabold text-green-deep">
            Paid ✓
          </span>
        </div>

        <dl className="flex flex-col gap-3 px-6 py-5 text-[14px]">
          {[
            ["Date", dateLabel],
            ["Time", t ? `${t} IST` : "—"],
            ["Duration", "45 minutes"],
            ["Booking ID", id],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4">
              <dt className="font-semibold text-muted">{k}</dt>
              <dd className={`font-extrabold tracking-tight ${k === "Booking ID" ? "rounded-lg bg-cream px-2 py-0.5 text-[13px]" : ""}`}>
                {v}
              </dd>
            </div>
          ))}
        </dl>

        <div className="px-6 pb-6">
          <a href={MEET_LINK} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
              <rect x="2.5" y="6" width="14" height="12" rx="2.5" />
              <path d="M16.5 10.5l5-3v9l-5-3" />
            </svg>
            Join Google Meet
          </a>
          <p className="mt-2.5 text-center text-[12px] font-semibold text-muted">
            The same link is in your WhatsApp and email — it activates 10 minutes before the session.
          </p>
        </div>
      </div>

      {/* delivery checklist */}
      <div className="mt-6 flex flex-col gap-2.5">
        {SENT.map((text, i) => (
          <div
            key={text}
            className="h-anim mx-auto flex items-center gap-2.5 text-[14px] font-bold text-ink-2"
            style={{ animationDelay: `${0.6 + i * 0.18}s` }}
          >
            <span className="grid size-6 place-items-center rounded-full bg-green-soft text-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </span>
            {text}
          </div>
        ))}
      </div>

      <div className="h-anim mt-9 flex flex-wrap items-center justify-center gap-3.5" style={{ animationDelay: "1.15s" }}>
        <a href="/meera" className="btn btn-ghost">
          Back to Meera&rsquo;s profile
        </a>
        <a href="/meera/book" className="btn btn-primary">
          Book another session
        </a>
      </div>
    </div>
  );
}
