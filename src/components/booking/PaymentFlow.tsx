"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { VerifiedBadge } from "../ui";

const PRICE = 1499;
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

type Method = "upi" | "card" | "netbanking";

const METHODS: { id: Method; label: string; note: string; icon: React.ReactNode }[] = [
  {
    id: "upi",
    label: "UPI",
    note: "GPay, PhonePe, Paytm — instant",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M7 11l5-8 5 8-5 8-5-8z" />
        <path d="M12 3v16" />
      </svg>
    ),
  },
  {
    id: "card",
    label: "Credit / Debit Card",
    note: "Visa, Mastercard, RuPay, Amex",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
        <path d="M2.5 10h19M6 15h4" />
      </svg>
    ),
  },
  {
    id: "netbanking",
    label: "Net Banking",
    note: "All major Indian banks",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-5" aria-hidden="true">
        <path d="M3 10l9-6 9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 18h18M3 21h18" />
      </svg>
    ),
  },
];

const BANKS = ["HDFC", "ICICI", "SBI", "Axis", "Kotak", "Other"];

export default function PaymentFlow({ d, t }: { d?: string; t?: string }) {
  const router = useRouter();
  const dateLabel = d
    ? new Date(`${d}T00:00:00`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })
    : null;

  const [method, setMethod] = useState<Method>("upi");
  const [bank, setBank] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "processing">("idle");

  function pay() {
    if (phase !== "idle") return;
    setPhase("processing");
    const id = "CR-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    setTimeout(
      () => router.push(`/booking/success?d=${d ?? ""}&t=${encodeURIComponent(t ?? "")}&id=${id}`),
      1500
    );
  }

  return (
    <div className="grid items-start gap-7 lg:grid-cols-[400px_1fr]">
      {/* ---- left: booking summary ---- */}
      <div className="overflow-hidden rounded-[26px] border border-line bg-paper shadow-card">
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
            <div className="truncate text-[12px] font-semibold text-muted">Career Coach</div>
          </div>
          <a
            href="/meera"
            className="ml-auto shrink-0 rounded-full border border-line bg-paper px-3 py-1.5 text-[12px] font-bold text-ink-2 transition-all duration-300 hover:-translate-y-px hover:border-ink"
          >
            View profile
          </a>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#FCE9E1] text-[17px]" aria-hidden="true">
              🎯
            </span>
            <div className="text-[15px] font-extrabold tracking-tight">1:1 Career Strategy Call</div>
          </div>

          <dl className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4 text-[13.5px]">
            {[
              ["Date", dateLabel ?? "—"],
              ["Time", t ? `${t} IST` : "—"],
              ["Duration", "45 minutes"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-muted">{k}</dt>
                <dd className="font-extrabold tracking-tight">{v}</dd>
              </div>
            ))}
            <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3.5">
              <dt className="text-[14.5px] font-extrabold">Total</dt>
              <dd className="text-[24px] font-black tracking-tight">{inr(PRICE)}</dd>
            </div>
          </dl>

          <div className="mt-4.5 flex flex-col gap-2 border-t border-line pt-4">
            {["Instant confirmation after payment", "Free reschedule up to 24 hrs before", "Full refund if your first session disappoints"].map(
              (text) => (
                <div key={text} className="flex items-center gap-2 text-[12.5px] font-semibold text-muted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="size-3.5 shrink-0 text-green" aria-hidden="true">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  {text}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* ---- right: payment methods ---- */}
      <div className="rounded-[26px] border border-line bg-paper p-6.5 max-sm:p-5">
        <h2 className="text-[18px] font-extrabold tracking-tight">Choose how to pay</h2>
        <div className="mt-4.5 flex flex-col gap-2.5">
          {METHODS.map((m) => {
            const sel = method === m.id;
            return (
              <div
                key={m.id}
                className={`overflow-hidden rounded-[18px] border-[1.5px] transition-all duration-300 ${
                  sel ? "border-ink shadow-soft" : "border-line hover:border-line-2"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setMethod(m.id)}
                  aria-pressed={sel}
                  className="flex w-full cursor-pointer items-center gap-3.5 px-5 py-4 text-left"
                >
                  <span className={`grid size-10 shrink-0 place-items-center rounded-xl transition-colors duration-300 ${sel ? "bg-ink text-cream" : "bg-cream text-ink-2"}`}>
                    {m.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[15px] font-extrabold tracking-tight">
                      {m.label}
                      {m.id === "upi" && (
                        <span className="rounded-full bg-green-soft px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-green-deep">
                          Recommended
                        </span>
                      )}
                    </span>
                    <span className="block text-[12.5px] font-semibold text-muted">{m.note}</span>
                  </span>
                  <span
                    className={`grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] transition-all duration-300 ${
                      sel ? "border-ink bg-ink" : "border-line-2"
                    }`}
                    aria-hidden="true"
                  >
                    {sel && <span className="size-2 rounded-full bg-cream pop-in" />}
                  </span>
                </button>

                {/* expanding panel */}
                <div className={`grid transition-[grid-template-rows] duration-400 ease-soft ${sel ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                  <div className="overflow-hidden">
                    <div className="border-t border-line px-5 py-4.5">
                      {m.id === "upi" && (
                        <div className="flex items-center gap-5 max-sm:flex-col max-sm:items-stretch">
                          <div className="flex-1">
                            <label className="block">
                              <span className="mb-1.5 block text-[13px] font-bold text-ink-2">Your UPI ID</span>
                              <input className="field" name="upi" placeholder="yourname@okhdfcbank" inputMode="email" />
                            </label>
                            <p className="mt-2 text-[12px] font-semibold text-muted">
                              You&rsquo;ll get a collect request on your UPI app — approve it to finish.
                            </p>
                          </div>
                          <div className="text-center">
                            <div className="pm-qr mx-auto size-[108px] rounded-xl border border-line" aria-label="UPI QR code" />
                            <div className="mt-1.5 text-[11px] font-bold text-faint">or scan to pay</div>
                          </div>
                        </div>
                      )}
                      {m.id === "card" && (
                        <div className="grid gap-3.5 sm:grid-cols-2">
                          <label className="block sm:col-span-2">
                            <span className="mb-1.5 block text-[13px] font-bold text-ink-2">Card number</span>
                            <input className="field" name="cardnum" placeholder="4242 4242 4242 4242" inputMode="numeric" autoComplete="cc-number" />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-[13px] font-bold text-ink-2">Expiry</span>
                            <input className="field" name="expiry" placeholder="MM / YY" inputMode="numeric" autoComplete="cc-exp" />
                          </label>
                          <label className="block">
                            <span className="mb-1.5 block text-[13px] font-bold text-ink-2">CVV</span>
                            <input className="field" name="cvv" type="password" placeholder="•••" inputMode="numeric" autoComplete="cc-csc" maxLength={4} />
                          </label>
                          <label className="block sm:col-span-2">
                            <span className="mb-1.5 block text-[13px] font-bold text-ink-2">Name on card</span>
                            <input className="field" name="cardname" placeholder="As printed on the card" autoComplete="cc-name" />
                          </label>
                        </div>
                      )}
                      {m.id === "netbanking" && (
                        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {BANKS.map((b) => {
                            const selBank = bank === b;
                            return (
                              <button
                                key={b}
                                type="button"
                                onClick={() => setBank(b)}
                                aria-pressed={selBank}
                                className={`rounded-[12px] border-[1.5px] px-2 py-3 text-[13px] font-bold transition-all duration-300 ease-spring ${
                                  selBank
                                    ? "scale-[1.04] border-ink bg-ink text-cream"
                                    : "cursor-pointer border-line text-ink-2 hover:-translate-y-0.5 hover:border-ink"
                                }`}
                              >
                                {b}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={pay}
          className="btn btn-grad btn-lg mt-6 w-full"
          aria-disabled={phase !== "idle"}
        >
          {phase === "processing" ? (
            <>
              <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />
              Processing payment…
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                <rect x="4" y="10" width="16" height="11" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Pay {inr(PRICE)}
            </>
          )}
        </button>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-muted">
          Secured by <b className="text-ink">Razorpay</b> · 256-bit SSL · demo checkout, no real money moves
        </div>
      </div>
    </div>
  );
}
