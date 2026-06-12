"use client";

import { useState } from "react";
import { ANANYA_AVATAR, PRIYA_AVATAR, ROHIT_AVATAR, VIKRAM_AVATAR } from "./persona";
import SlotRow from "./SlotRow";
import { Check, VerifiedBadge } from "./ui";

const TABS = [
  { id: "profile", label: "Creator profile" },
  { id: "booking", label: "Booking flow" },
  { id: "payment", label: "Payments" },
  { id: "dashboard", label: "Dashboard" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function PaneCopy({ title, copy, points }: { title: string; copy: string; points: string[] }) {
  return (
    <div>
      <h3 className="mb-3 text-[clamp(23px,2.6vw,30px)] font-bold tracking-tight">{title}</h3>
      <p className="mb-5 text-[15.5px] font-medium leading-relaxed text-muted">{copy}</p>
      <ul className="flex flex-col gap-2.5">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5 text-[14.5px] font-semibold text-ink-2">
            <Check className="mt-px size-[19px] shrink-0 text-green" />
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KpiLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint">{children}</div>;
}

export default function Showcase() {
  const [tab, setTab] = useState<TabId>("profile");

  return (
    <div>
      <div className="mb-8 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border-[1.5px] px-5.5 py-2.5 text-sm font-bold transition-all duration-300 ${
              tab === t.id
                ? "border-ink bg-ink text-cream shadow-soft"
                : "border-line-2 text-muted hover:border-ink hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative min-h-[480px] overflow-hidden rounded-[30px] border border-line bg-grad-soft p-[clamp(22px,4vw,52px)]">
        {/* ---------------- profile ---------------- */}
        {tab === "profile" && (
          <div className="pane-in grid items-center gap-[clamp(24px,4vw,56px)] md:grid-cols-2">
            <PaneCopy
              title="A storefront, not a list of links"
              copy="Your public page sells for you: services with clear prices, proof of experience, ratings, and one obvious action — book a session."
              points={[
                "Services, packages & digital products in one place",
                "Social proof: ratings, session count, testimonials",
                "Your handle: creatoros.in/you — or your own domain",
              ]}
            />
            <div className="flex justify-center max-md:order-first">
              <div className="w-[286px] rounded-[34px] border border-line bg-paper p-3.5 shadow-pop">
                <div className="mx-auto mb-3.5 mt-0.5 h-[5px] w-[84px] rounded-full bg-line-2" />
                <div className="flex flex-col items-center px-2 pb-3.5 pt-1.5 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={VIKRAM_AVATAR}
                    alt="Vikram Iyer"
                    className="mb-2.5 size-16 rounded-full border-[3px] border-white object-cover outline outline-[2.5px] outline-offset-2 outline-terra"
                  />
                  <div className="flex items-center gap-1.5 text-[16.5px] font-extrabold tracking-tight">
                    Vikram Iyer <VerifiedBadge />
                  </div>
                  <div className="mt-0.5 text-xs font-medium text-muted">Strength coach · Online + Bengaluru</div>
                  <div className="mt-2.5 flex gap-3.5 text-[11px] font-semibold text-faint">
                    <span><b className="text-[12.5px] text-ink">520+</b> sessions</span>
                    <span><b className="text-[12.5px] text-ink">4.8</b> ★</span>
                    <span><b className="text-[12.5px] text-ink">8 yrs</b> exp</span>
                  </div>
                </div>
                {[
                  { icon: "💪", bg: "bg-[#FCE9E1]", title: "1:1 Training Session", meta: "60 min · Online", price: "₹999" },
                  { icon: "🥗", bg: "bg-[#FDF3DF]", title: "Nutrition Plan", meta: "Monthly · PDF + check-ins", price: "₹2,499" },
                ].map((s) => (
                  <div key={s.title} className="mt-2.5 flex items-center gap-3 rounded-2xl border border-line bg-cream p-3">
                    <div className={`grid size-9 shrink-0 place-items-center rounded-[11px] text-base ${s.bg}`}>{s.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold tracking-tight">{s.title}</div>
                      <div className="text-[10.5px] font-semibold text-faint">{s.meta}</div>
                    </div>
                    <div className="text-[13px] font-extrabold">{s.price}</div>
                  </div>
                ))}
                <div className="mt-3 w-full rounded-full bg-ink py-2.5 text-center text-[13px] font-bold text-cream">
                  Book a session →
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- booking ---------------- */}
        {tab === "booking" && (
          <div className="pane-in grid items-center gap-[clamp(24px,4vw,56px)] md:grid-cols-2">
            <PaneCopy
              title="Three taps from link to confirmed slot"
              copy="Clients pick a service, pick a time from your real availability, and pay — all on one page, on their phone, in under a minute."
              points={[
                "Live availability synced with your calendar",
                "Buffers, daily limits and minimum notice — your rules",
                "Meet link generated and shared automatically",
              ]}
            />
            <div className="flex justify-center max-md:order-first">
              <div className="w-full max-w-[360px] rounded-[22px] border border-line bg-paper p-6.5 shadow-pop">
                <KpiLabel>Choose a slot · Fri, 13 June</KpiLabel>
                <div className="mb-3.5 mt-2.5">
                  <SlotRow
                    initial={2}
                    slots={[{ time: "9:00 am", taken: true }, { time: "10:30 am" }, { time: "5:00 pm" }, { time: "6:30 pm" }]}
                  />
                </div>
                <KpiLabel>Your details</KpiLabel>
                <div className="mb-2 mt-2.5 rounded-xl border border-line px-3.5 py-[11px] text-[13px] font-semibold text-faint">
                  Rohit Kapoor
                </div>
                <div className="mb-4 rounded-xl border border-line px-3.5 py-[11px] text-[13px] font-semibold text-faint">
                  rohit@gmail.com
                </div>
                <div className="w-full rounded-full bg-ink py-2.5 text-center text-[13px] font-bold text-cream">
                  Pay ₹1,499 &amp; confirm →
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- payment ---------------- */}
        {tab === "payment" && (
          <div className="pane-in grid items-center gap-[clamp(24px,4vw,56px)] md:grid-cols-2">
            <PaneCopy
              title="Paid upfront. Settled to you. Zero cut."
              copy="UPI checkout is built into the booking — scan, pay, done. The money goes to your account, not a platform wallet, and CreatorOS takes nothing."
              points={[
                "UPI, cards & netbanking — UPI settles instantly",
                "Automatic receipts & GST-ready invoices",
                "One-tap refunds when plans change",
              ]}
            />
            <div className="flex justify-center max-md:order-first">
              <div className="w-full max-w-[360px] rounded-[22px] border border-line bg-paper p-6.5 text-center shadow-pop">
                <KpiLabel>Paying Meera Shah</KpiLabel>
                <div className="mt-2 text-[38px] font-black tracking-tighter">₹1,499</div>
                <div className="mb-5 text-[13px] font-semibold text-muted">1:1 Career Strategy Call · Fri 5:00 pm</div>
                <div className="pm-qr mx-auto mb-4.5 size-[148px] rounded-2xl border border-line" aria-label="UPI QR code" />
                <div className="mb-4 flex flex-wrap justify-center gap-2">
                  {["GPay", "PhonePe", "Paytm", "BHIM"].map((u) => (
                    <span key={u} className="rounded-full border border-line px-3 py-1.5 text-[11px] font-extrabold text-ink-2">
                      {u}
                    </span>
                  ))}
                </div>
                <div className="rounded-[10px] bg-green-soft p-2.5 text-xs font-bold text-green-deep">
                  ✓ 100% goes to the creator · 0% platform fee
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- dashboard ---------------- */}
        {tab === "dashboard" && (
          <div className="pane-in grid items-center gap-[clamp(24px,4vw,56px)] md:grid-cols-2">
            <PaneCopy
              title="Your whole business, on one screen"
              copy="Revenue, upcoming sessions, top clients and product sales — the numbers you check every morning, without exporting a single spreadsheet."
              points={[
                "Revenue & booking trends, week by week",
                "Today’s schedule with join links & client notes",
                "Payouts, invoices and refunds in one ledger",
              ]}
            />
            <div className="flex justify-center max-md:order-first">
              <div className="w-full max-w-[520px] overflow-hidden rounded-[22px] border border-line bg-paper shadow-pop">
                <div className="flex items-center justify-between border-b border-line px-4.5 py-3.5">
                  <b className="text-[13.5px] tracking-tight">Good morning, Meera ☀️</b>
                  <span className="text-[11px] font-bold text-faint">Wed, 11 June</span>
                </div>
                <div className="p-4.5">
                  <div className="mb-3.5 grid grid-cols-3 gap-2.5">
                    {[
                      { l: "Revenue", v: "₹84,500", d: "↑ 23%" },
                      { l: "Bookings", v: "47", d: "↑ 12" },
                      { l: "No-shows", v: "2%", d: "↓ 9%" },
                    ].map((k) => (
                      <div key={k.l} className="rounded-2xl border border-line bg-cream px-3 py-3">
                        <KpiLabel>{k.l}</KpiLabel>
                        <div className="mt-0.5 text-lg font-black tracking-tight">{k.v}</div>
                        <div className="mt-0.5 text-[10.5px] font-bold text-green">{k.d}</div>
                      </div>
                    ))}
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-line">
                    <div className="flex items-center gap-2.5 bg-cream px-3.5 py-2.5 text-[10.5px] font-extrabold uppercase tracking-wider text-faint">
                      <span className="flex-[1.4]">Client</span>
                      <span className="flex-1">Session</span>
                      <span className="flex-[0.9]">Amount</span>
                      <span className="w-[74px] text-right">Status</span>
                    </div>
                    {[
                      { img: ANANYA_AVATAR, name: "Ananya S.", session: "Strategy call", amt: "₹1,499", badge: "paid", label: "Paid" },
                      { img: ROHIT_AVATAR, name: "Rohit K.", session: "Resume review", amt: "₹799", badge: "paid", label: "Paid" },
                      { img: PRIYA_AVATAR, name: "Priya N.", session: "Interview kit", amt: "₹499", badge: "new", label: "New" },
                    ].map((r) => (
                      <div key={r.name} className="flex items-center gap-2.5 border-t border-line px-3.5 py-[11px] text-[12.5px]">
                        <span className="flex flex-[1.4] items-center gap-2 font-bold">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={r.img} alt="" className="size-[26px] rounded-full object-cover" />
                          {r.name}
                        </span>
                        <span className="flex-1 font-semibold text-muted">{r.session}</span>
                        <span className="flex-[0.9] font-extrabold">{r.amt}</span>
                        <span className="flex w-[74px] justify-end">
                          <span className={`badge badge-${r.badge}`}>{r.label}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
