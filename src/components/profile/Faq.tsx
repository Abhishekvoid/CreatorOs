"use client";

import { useState } from "react";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "What happens after I book?",
    a: "You pay via UPI and the session is confirmed instantly — no waiting for approval. Within seconds you get the Google Meet link and a calendar invite on WhatsApp and email, plus a short intake form so I can read up on your situation before we meet.",
  },
  {
    q: "Can I reschedule?",
    a: "Yes — once, free of charge, up to 12 hours before the session. There's a one-tap reschedule link right inside your WhatsApp confirmation, so you never have to message me to move a slot.",
  },
  {
    q: "Do I get a recording?",
    a: "Every 1:1 call is recorded (with your consent) and shared within 24 hours, along with my written notes and the action plan we agree on. Async services like the Resume Review come with a recorded video walkthrough by default.",
  },
  {
    q: "What is your refund policy?",
    a: "If you leave your first session feeling it wasn't worth it, tell me within 24 hours and I'll refund 100% — no questions, no forms. Digital products are refundable within 7 days if they're not what you expected.",
  },
  {
    q: "How should I prepare?",
    a: "Fill in the intake form, attach your current resume and (if relevant) the job description you're targeting. Then come with one specific goal for the call — the narrower the question, the more we get done in 45 minutes.",
  },
  {
    q: "Do you take sessions in Hindi?",
    a: "Yes. Sessions run in English, Hindi, or any mix of the two — whatever you think in. Written deliverables like resume rewrites are in English.",
  },
];

function FaqItem({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div
      className={`rounded-[20px] border bg-paper transition-all duration-300 ${
        open ? "border-line-2 shadow-soft" : "border-line"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-[16px] font-extrabold tracking-tight">{q}</span>
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full border border-line text-muted transition-all duration-400 ease-spring ${
            open ? "rotate-45 border-terra bg-[#FCE9E1] text-terra-deep" : ""
          }`}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" className="size-3.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-400 ease-soft ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <p className="max-w-[640px] px-6 pb-5.5 text-[14.5px] font-medium leading-relaxed text-ink-2">{a}</p>
        </div>
      </div>
    </div>
  );
}

export default function Faq({ items = ITEMS }: { items?: { q: string; a: string }[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-3">
      {items.map((item, i) => (
        <FaqItem key={item.q} {...item} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
      ))}
    </div>
  );
}
