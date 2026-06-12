"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ARJUN_AVATAR, MEERA_AVATAR, PRIYA_AVATAR, ROHIT_AVATAR } from "../persona";
import { VerifiedBadge } from "../ui";

/* ---------------- pricing ---------------- */
const MRP = 1999;
const PRICE = 1499;
const TOTAL = PRICE; // MVP: all-inclusive price, no tax line items
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

/* ---------------- availability model ---------------- */
const SLOT_GROUPS = [
  { label: "Morning", slots: ["9:00 am", "10:30 am"] },
  { label: "Afternoon", slots: ["12:00 pm", "2:30 pm", "4:00 pm"] },
  { label: "Evening", slots: ["5:00 pm", "6:30 pm", "8:00 pm"] },
];
const ALL_SLOTS = SLOT_GROUPS.flatMap((g) => g.slots);

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

function isAvailable(date: Date, today: Date) {
  if (date < today || date > addDays(today, 35)) return false;
  if (date.getDay() === 0) return false; // Sundays off
  if (date.getDate() % 9 === 4) return false; // the occasional fully-booked day
  return true;
}

function takenSlots(date: Date, today: Date): Set<string> {
  if (sameDay(date, today)) return new Set(ALL_SLOTS.slice(0, ALL_SLOTS.length - 3)); // 3 left today
  const taken = new Set<string>();
  ALL_SLOTS.forEach((s, i) => {
    if ((date.getDate() * (i + 3)) % 4 === 0) taken.add(s);
  });
  return taken;
}

const dateLabel = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

/* ---------------- small building blocks ---------------- */
function StepHead({ n, title, hint }: { n: number; title: string; hint?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-3">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink text-[12.5px] font-extrabold text-cream">
          {n}
        </span>
        <h2 className="text-[18px] font-extrabold tracking-tight">{title}</h2>
      </div>
      {hint}
    </div>
  );
}

function Field({
  label,
  optional,
  textarea,
  rows,
  hint,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> &
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label: string;
    optional?: boolean;
    textarea?: boolean;
    hint?: string;
  }) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline gap-2 text-[13px] font-bold text-ink-2">
        {label}
        {optional && <span className="text-[11.5px] font-semibold text-faint">optional</span>}
      </span>
      {textarea ? <textarea className="field resize-y" rows={rows ?? 4} {...rest} /> : <input className="field" {...rest} />}
      {hint && <span className="mt-1.5 block text-[12px] font-semibold text-muted">{hint}</span>}
    </label>
  );
}

function Calendar({
  today,
  selected,
  onSelect,
}: {
  today: Date;
  selected: Date | null;
  onSelect: (d: Date) => void;
}) {
  const [offset, setOffset] = useState(0);
  const view = new Date(today.getFullYear(), today.getMonth() + offset, 1);
  const lead = (view.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.getFullYear(), view.getMonth(), i + 1)),
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[15.5px] font-extrabold tracking-tight">
          {view.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </div>
        <div className="flex gap-1.5">
          {[
            { dir: -1, label: "Previous month", path: "M15 18l-6-6 6-6" },
            { dir: 1, label: "Next month", path: "M9 6l6 6-6 6" },
          ].map((b) => {
            const disabled = b.dir === -1 ? offset === 0 : offset === 1;
            return (
              <button
                key={b.label}
                type="button"
                aria-label={b.label}
                disabled={disabled}
                onClick={() => setOffset(offset + b.dir)}
                className={`grid size-8 place-items-center rounded-full border border-line text-ink-2 transition-all duration-300 ${
                  disabled ? "cursor-default opacity-35" : "cursor-pointer hover:-translate-y-0.5 hover:border-ink hover:shadow-soft"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
                  <path d={b.path} />
                </svg>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="pb-1 text-center text-[11px] font-extrabold uppercase tracking-wider text-faint">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={`x${i}`} />;
          const open = isAvailable(d, today);
          const sel = selected !== null && sameDay(d, selected);
          const isToday = sameDay(d, today);
          return (
            <button
              key={d.getTime()}
              type="button"
              disabled={!open}
              onClick={() => onSelect(d)}
              aria-pressed={sel}
              className={`relative grid aspect-square place-items-center rounded-[12px] text-[13.5px] font-bold transition-all duration-300 ease-spring ${
                sel
                  ? "scale-105 bg-ink text-cream shadow-[0_6px_16px_-4px_rgba(25,23,18,.45)]"
                  : open
                    ? "cursor-pointer text-ink hover:-translate-y-0.5 hover:bg-cream-2"
                    : "cursor-default text-faint/60"
              } ${isToday && !sel ? "outline outline-[1.5px] outline-offset-[-1.5px] outline-terra" : ""}`}
            >
              {d.getDate()}
              {isToday && (
                <span className={`absolute bottom-[5px] size-1 rounded-full ${sel ? "bg-amber" : "bg-terra"}`} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- main flow ---------------- */
export default function BookingFlow() {
  // availability is date-dependent; gate on mount so SSR and client never disagree
  const [today, setToday] = useState<Date | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setToday(startOfDay(new Date())), []);

  const router = useRouter();
  const [date, setDate] = useState<Date | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "processing">("idle");

  const ready = date !== null && slot !== null;
  const taken = date && today ? takenSlots(date, today) : new Set<string>();
  const isTodaySelected = date !== null && today !== null && sameDay(date, today);

  function pickDate(d: Date) {
    setDate(d);
    setSlot(null);
  }

  function continueToPayment() {
    if (!ready || phase !== "idle") return;
    setPhase("processing");
    const d = `${date!.getFullYear()}-${String(date!.getMonth() + 1).padStart(2, "0")}-${String(
      date!.getDate()
    ).padStart(2, "0")}`;
    router.push(`/meera/book/payment?d=${d}&t=${encodeURIComponent(slot!)}`);
  }

  const ctaLabel =
    phase === "processing" ? (
      <>
        <span className="size-4 animate-spin rounded-full border-2 border-white/35 border-t-white" aria-hidden="true" />
        Opening secure checkout…
      </>
    ) : ready ? (
      <>
        Continue • {inr(TOTAL)} <span className="arr">→</span>
      </>
    ) : (
      <>Select a date &amp; time</>
    );

  const cta = (full = true) => (
    <button
      type="button"
      onClick={continueToPayment}
      aria-disabled={!ready}
      className={`btn btn-grad ${full ? "btn-lg w-full" : "!px-5 !py-2.5 !text-[14px]"} ${
        !ready ? "cursor-not-allowed opacity-50 saturate-50" : ""
      }`}
    >
      {ctaLabel}
    </button>
  );

  return (
    <>
      <div className="grid items-start gap-7 lg:grid-cols-[1fr_392px]">
        {/* ================= left: booking experience ================= */}
        <div className="flex min-w-0 flex-col gap-5">
          {/* service overview */}
          <section className="rounded-[26px] border border-line bg-paper p-6.5 shadow-soft max-sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-4">
                <div className="grid size-13 shrink-0 place-items-center rounded-2xl bg-[#FCE9E1] text-[24px]">
                  <span aria-hidden="true">🎯</span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-[20px] font-extrabold tracking-tight">1:1 Career Strategy Call</h2>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-green-soft px-2.5 py-1 text-[11px] font-extrabold text-green-deep">
                      <span className="size-1.5 rounded-full bg-current" /> Open this week
                    </span>
                  </div>
                  <p className="mt-1.5 max-w-[440px] text-[13.5px] font-medium leading-relaxed text-muted">
                    A focused 45 minutes on where you&rsquo;re stuck, what you&rsquo;re worth, and your exact next
                    three moves — you leave with a written plan.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {["45 min", "Google Meet", "Recording included", "English · Hindi"].map((m) => (
                      <span key={m} className="rounded-full border border-line bg-cream px-2.5 py-1 text-[12px] font-bold text-ink-2">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <s className="block text-[13px] font-semibold text-faint">{inr(MRP)}</s>
                <b className="text-[26px] font-black leading-none tracking-tight">{inr(PRICE)}</b>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 border-t border-line pt-4.5 lg:grid-cols-4">
              {[
                ["⚡", "Instant confirmation"],
                ["📅", "Calendar invite sent"],
                ["💬", "WhatsApp reminders"],
                ["🔁", "Free rescheduling"],
              ].map(([icon, text]) => (
                <div key={text} className="flex items-center gap-2 text-[12.5px] font-bold text-ink-2">
                  <span aria-hidden="true">{icon}</span> {text}
                </div>
              ))}
            </div>
          </section>

          {/* 1 — date */}
          <section className="rounded-[26px] border border-line bg-paper p-6.5 max-sm:p-5">
            <StepHead
              n={1}
              title="Pick a date"
              hint={
                <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-cream px-3 py-1.5 text-[12px] font-bold text-muted">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5" aria-hidden="true">
                    <circle cx="12" cy="12" r="9.2" />
                    <path d="M2.8 12h18.4M12 2.8c2.5 2.4 3.8 5.6 3.8 9.2s-1.3 6.8-3.8 9.2c-2.5-2.4-3.8-5.6-3.8-9.2s1.3-6.8 3.8-9.2z" />
                  </svg>
                  Asia/Kolkata · IST
                </span>
              }
            />
            {today ? (
              <Calendar today={today} selected={date} onSelect={pickDate} />
            ) : (
              <div className="h-[316px] animate-pulse rounded-2xl bg-cream-2" aria-hidden="true" />
            )}
          </section>

          {/* 2 — time */}
          <section className="rounded-[26px] border border-line bg-paper p-6.5 max-sm:p-5">
            <StepHead
              n={2}
              title="Pick a time"
              hint={
                isTodaySelected ? (
                  <span className="pop-in rounded-full bg-[#FDF3DF] px-3 py-1.5 text-[12px] font-extrabold text-[#9A6A14]">
                    ⚡ Only 3 slots left today
                  </span>
                ) : date ? (
                  <span className="pop-in text-[13px] font-bold text-muted">{dateLabel(date)}</span>
                ) : undefined
              }
            />
            {date && today ? (
              <div key={date.getTime()} className="pop-in flex flex-col gap-5">
                {SLOT_GROUPS.map((g) => {
                  const free = g.slots.filter((s) => !taken.has(s));
                  if (free.length === 0) return null;
                  return (
                    <div key={g.label}>
                      <div className="mb-2 text-[11.5px] font-extrabold uppercase tracking-wider text-faint">
                        {g.label}
                      </div>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {g.slots.map((s) => {
                          const isTaken = taken.has(s);
                          const sel = slot === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              disabled={isTaken}
                              onClick={() => setSlot(s)}
                              aria-pressed={sel}
                              className={`rounded-[14px] border-[1.5px] px-3 py-3 text-[13.5px] font-bold transition-all duration-300 ease-spring ${
                                sel
                                  ? "scale-[1.04] border-ink bg-ink text-cream shadow-[0_8px_18px_-6px_rgba(25,23,18,.5)]"
                                  : isTaken
                                    ? "cursor-default border-line text-faint/60 line-through"
                                    : "cursor-pointer border-line bg-paper text-ink-2 hover:-translate-y-0.5 hover:border-terra hover:text-terra-deep hover:shadow-soft"
                              }`}
                            >
                              {s}
                              {sel && " ✓"}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid place-items-center rounded-2xl border-[1.5px] border-dashed border-line-2 py-10 text-center">
                <p className="text-[14px] font-semibold text-muted">
                  Pick a date first — available times will show up here.
                </p>
              </div>
            )}
          </section>

          {/* 3 — client details */}
          <section className="rounded-[26px] border border-line bg-paper p-6.5 max-sm:p-5">
            <StepHead n={3} title="Your details" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name" name="name" placeholder="Ananya Sharma" autoComplete="name" required />
              <Field label="Email address" name="email" type="email" placeholder="you@email.com" autoComplete="email" required />
              <Field
                label="WhatsApp number"
                name="whatsapp"
                type="tel"
                placeholder="+91 98765 43210"
                autoComplete="tel"
                required
                hint="Confirmation & reminders arrive here"
              />
              <Field label="LinkedIn URL" name="linkedin" type="url" placeholder="linkedin.com/in/you" optional />
              <Field label="Current role" name="role" placeholder="Senior Product Manager" optional />
              <Field label="Current company" name="company" placeholder="Acme Corp" optional />
              <div className="sm:col-span-2">
                <Field
                  label="What do you want help with?"
                  name="goal"
                  textarea
                  rows={5}
                  required
                  placeholder="Describe your goal, your biggest challenge right now, and what a great outcome from this session looks like…"
                  hint="The more specific you are, the more we get done in 45 minutes."
                />
              </div>
            </div>
          </section>

          {/* 4 — creator intake questions */}
          <section className="rounded-[26px] border border-line bg-paper p-6.5 max-sm:p-5">
            <StepHead
              n={4}
              title="A few questions from Meera"
              hint={<span className="text-[12.5px] font-semibold text-muted">Helps her prepare before the call</span>}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[13px] font-bold text-ink-2">Current salary range</span>
                <select className="field cursor-pointer" name="salary" defaultValue="">
                  <option value="" disabled>
                    Select a range
                  </option>
                  {["Below ₹6 LPA", "₹6–12 LPA", "₹12–25 LPA", "₹25–50 LPA", "₹50 LPA+", "Prefer not to say"].map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <Field label="Target role" name="target" placeholder="e.g. Director of Product" />
              <Field label="Resume link" name="resume" type="url" placeholder="Google Drive / Dropbox link" hint="Set sharing to “anyone with the link”" />
              <Field label="Portfolio link" name="portfolio" type="url" placeholder="yoursite.com" optional />
              <div className="sm:col-span-2">
                <span className="mb-2 block text-[13px] font-bold text-ink-2">Biggest challenge right now</span>
                <div className="flex flex-wrap gap-2">
                  {["Getting interview calls", "Resume shortlists", "Salary negotiation", "Career switch", "Getting promoted"].map((c) => {
                    const sel = challenge === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setChallenge(sel ? null : c)}
                        aria-pressed={sel}
                        className={`rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition-all duration-300 ease-spring active:scale-95 ${
                          sel
                            ? "scale-[1.03] border-ink bg-ink text-cream shadow-soft"
                            : "border-line bg-paper text-ink-2 hover:-translate-y-0.5 hover:border-ink"
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="sm:col-span-2">
                <Field label="Additional notes" name="notes" textarea rows={3} placeholder="Anything else Meera should know before the session" optional />
              </div>
            </div>
          </section>

          {/* booking policies */}
          <section className="rounded-[26px] border border-line bg-paper p-6.5 max-sm:p-5">
            <h2 className="mb-4.5 text-[18px] font-extrabold tracking-tight">Booking policies</h2>
            <div className="grid gap-x-6 gap-y-3.5 sm:grid-cols-2">
              {[
                ["Secure payment", "Processed by Razorpay over 256-bit SSL — card details never touch our servers."],
                ["Instant confirmation", "Your slot is locked the moment payment succeeds. No approval wait."],
                ["Google Meet invite", "Sent automatically to your email and WhatsApp with a calendar invite."],
                ["WhatsApp reminders", "24 hours and 1 hour before the session, so you never miss it."],
                ["Reschedule up to 24 hrs before", "One free reschedule with a single tap from your confirmation."],
                ["Fair refunds", "Unhappy after your first session? Full refund within 24 hours — no forms."],
              ].map(([title, text]) => (
                <div key={title} className="flex items-start gap-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-green-soft text-green">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <div>
                    <div className="text-[14px] font-extrabold tracking-tight">{title}</div>
                    <div className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-muted">{text}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ================= right: sticky order summary ================= */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-24">
          <div className="overflow-hidden rounded-[26px] border border-line bg-paper shadow-card">
            <div className="flex items-center gap-3 border-b border-line bg-cream px-6 py-4">
              <img
                src={MEERA_AVATAR}
                alt="Meera Shah"
                className="size-11 rounded-full border-2 border-white object-cover outline outline-[1.5px] outline-offset-1 outline-terra"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[15px] font-extrabold tracking-tight">
                  Meera Shah <VerifiedBadge />
                </div>
                <div className="truncate text-[12px] font-semibold text-muted">Career Coach · replies in ~2 hrs</div>
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
                  ["Date", date ? dateLabel(date) : null],
                  ["Time", slot ? `${slot} IST` : null],
                  ["Duration", "45 minutes"],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex items-baseline justify-between gap-4">
                    <dt className="font-semibold text-muted">{k}</dt>
                    {v ? (
                      <dd key={v as string} className="pop-in font-extrabold tracking-tight">
                        {v}
                      </dd>
                    ) : (
                      <dd className="font-semibold text-faint">Not selected</dd>
                    )}
                  </div>
                ))}
              </dl>

              <dl className="mt-4 flex flex-col gap-2.5 border-t border-line pt-4 text-[13.5px]">
                <div className="flex items-baseline justify-between">
                  <dt className="font-semibold text-muted">Session fee</dt>
                  <dd className="font-bold">{inr(PRICE)}</dd>
                </div>
                <div className="mt-1 flex items-baseline justify-between border-t border-line pt-3.5">
                  <dt className="text-[14.5px] font-extrabold">Total</dt>
                  <dd className="text-[24px] font-black tracking-tight">{inr(TOTAL)}</dd>
                </div>
              </dl>

              <div className="mt-4 flex items-center justify-center gap-1.5 text-[12px] font-bold text-[#9A6A14]">
                <span className="size-1.5 rounded-full bg-amber animate-pulse-dot" aria-hidden="true" />
                Only 3 slots left this week · last booked 12 min ago
              </div>
              <div className="mt-2.5">{cta()}</div>
              <p className="mt-3 text-center text-[12px] font-semibold text-muted">
                {ready ? "You'll review everything before paying." : "Pick a date and time above to continue."}
              </p>

              <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                {["UPI", "Visa", "Mastercard", "RuPay", "Net Banking"].map((m) => (
                  <span key={m} className="rounded-lg border border-line bg-cream px-2.5 py-1 text-[11px] font-extrabold tracking-tight text-ink-2">
                    {m}
                  </span>
                ))}
              </div>
              <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[11.5px] font-bold text-muted">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5 text-green" aria-hidden="true">
                  <rect x="4" y="10" width="16" height="11" rx="2.5" />
                  <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                </svg>
                Secured by <b className="text-ink">Razorpay</b> · 256-bit SSL
              </div>
            </div>
          </div>

          {/* recent activity */}
          <div className="rounded-[26px] border border-line bg-paper p-5">
            <div className="mb-3 flex items-center gap-2 text-[11.5px] font-extrabold uppercase tracking-wider text-faint">
              <span className="size-[7px] rounded-full bg-green animate-pulse-dot" />
              Recent bookings
            </div>
            <div className="flex flex-col gap-3">
              {[
                { img: ROHIT_AVATAR, text: "Rohit booked a Strategy Call", when: "5 min ago" },
                { img: PRIYA_AVATAR, text: "Priya booked a Mock Interview", when: "yesterday" },
                { img: ARJUN_AVATAR, text: "Arjun booked a Resume Review", when: "this week" },
              ].map((a) => (
                <div key={a.text} className="flex items-center gap-2.5">
                  <img src={a.img} alt="" className="size-7 rounded-full object-cover" />
                  <span className="flex-1 truncate text-[12.5px] font-bold text-ink-2">{a.text}</span>
                  <span className="shrink-0 text-[11.5px] font-semibold text-faint">{a.when}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* ================= mobile sticky checkout bar ================= */}
      <div
        className="fixed inset-x-0 bottom-0 z-90 border-t border-line bg-paper/92 backdrop-blur-xl lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[17px] font-black tracking-tight">{inr(TOTAL)}</div>
            <div className="truncate text-[11.5px] font-semibold text-muted">
              {ready ? (
                <span key={`${date!.getTime()}-${slot}`} className="pop-in inline-block">
                  {dateLabel(date!)} · {slot} IST
                </span>
              ) : (
                "no hidden fees · pick a date & time"
              )}
            </div>
          </div>
          {cta(false)}
        </div>
      </div>
    </>
  );
}
