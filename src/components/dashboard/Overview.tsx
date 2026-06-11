import Counter from "../Counter";

/* ---------------- welcome hero ---------------- */
export function HeroCard() {
  return (
    <section className="glow-tr relative flex flex-col overflow-hidden rounded-[28px] border border-[#2E2A21] bg-linear-165 from-[#211E17] to-[#191712] p-7 text-cream shadow-card max-sm:p-6">
      <div className="relative flex flex-wrap items-start justify-between gap-x-6 gap-y-5">
        <div>
          <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em]">
            Your <span className="font-serif italic font-normal">creator business.</span>
          </h1>
          <p className="mt-1.5 max-w-[380px] text-[13.5px] font-medium text-[#B5B0A4]">
            Everything happening across bookings, payments and clients — in one calm place.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <a href="/meera" className="btn btn-grad !px-5 !py-2.5 !text-[13.5px]">
            View public profile
          </a>
          <a
            href="#"
            className="btn !border-[1.5px] !border-cream/20 !bg-transparent !px-5 !py-2.5 !text-[13.5px] !text-cream hover:!border-cream/50"
          >
            Share link
          </a>
        </div>
      </div>

      <div className="relative mt-7 flex flex-wrap gap-x-9 gap-y-4 border-t border-cream/10 pt-5">
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#8E897D]">Revenue · this month</div>
          <div className="mt-1 flex items-baseline gap-2.5">
            <span className="text-[32px] font-black leading-none tracking-tight">
              ₹<Counter to={24500} />
            </span>
            <span className="rounded-full bg-green/20 px-2 py-0.5 text-[11.5px] font-extrabold text-[#7BD3AC]">
              ↑ 18%
            </span>
          </div>
        </div>
        <div className="border-l border-cream/10 pl-9 max-sm:border-0 max-sm:pl-0">
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#8E897D]">Bookings</div>
          <div className="mt-1 text-[32px] font-black leading-none tracking-tight">
            <Counter to={27} />
          </div>
        </div>
        <div className="border-l border-cream/10 pl-9 max-sm:border-0 max-sm:pl-0">
          <div className="text-[11.5px] font-bold uppercase tracking-wider text-[#8E897D]">Active clients</div>
          <div className="mt-1 text-[32px] font-black leading-none tracking-tight">
            <Counter to={14} />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- onboarding ---------------- */
export type OnboardingItem = { label: string; done: boolean };

const DEFAULT_STEPS: OnboardingItem[] = [
  { label: "Upload profile photo", done: true },
  { label: "Set your handle", done: true },
  { label: "Create first service", done: true },
  { label: "Connect Google Calendar", done: false },
  { label: "Connect payments", done: false },
  { label: "Publish profile", done: false },
];

export function OnboardingCard({ steps = DEFAULT_STEPS }: { steps?: OnboardingItem[] }) {
  const done = steps.filter((s) => s.done).length;
  const next = steps.find((s) => !s.done);
  const pct = Math.round((done / steps.length) * 100);

  return (
    <section className="dot-texture relative overflow-hidden rounded-[28px] border border-line bg-grad-soft p-6.5 max-sm:p-5">
      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[18px] font-extrabold tracking-tight">Get your first booking</h2>
            <p className="mt-0.5 text-[13px] font-semibold text-muted">
              {steps.length - done} steps left · about {Math.max(steps.length - done, 1) * 2} minutes
            </p>
          </div>
          <span className="rounded-full bg-paper px-3 py-1.5 text-[12.5px] font-extrabold shadow-soft">
            {done} / {steps.length} completed
          </span>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-paper/80" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-grad transition-[width] duration-500 ease-soft" style={{ width: `${pct}%` }} />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {steps.map((s) => {
            const isNext = s === next;
            return (
              <div
                key={s.label}
                className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-3 text-[13px] font-bold transition-colors duration-200 ${
                  s.done
                    ? "bg-paper/60 text-muted"
                    : isNext
                      ? "border-[1.5px] border-terra bg-paper text-ink shadow-soft"
                      : "bg-paper/60 text-ink-2"
                }`}
              >
                {s.done ? (
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-green text-white">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-3" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                ) : (
                  <span className={`size-5 shrink-0 rounded-full border-[1.5px] ${isNext ? "border-terra" : "border-line-2"}`} />
                )}
                {s.label}
                {isNext && (
                  <span className="ml-auto rounded-full bg-[#FCE9E1] px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide text-terra-deep">
                    Next
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-4">
          <a href="#" className="btn btn-primary !px-5.5 !py-2.5 !text-[13.5px]">
            Continue setup <span className="arr">→</span>
          </a>
          <span className="text-[12.5px] font-semibold text-muted">
            Creators who finish setup get their first booking <b className="text-ink-2">3× faster</b>.
          </span>
        </div>
      </div>
    </section>
  );
}

/* ---------------- stats grid ---------------- */
const STATS = [
  {
    label: "Bookings",
    value: <Counter to={27} />,
    trend: "+5 this week",
    up: true,
    spark: "M0 18 L10 15 L20 16 L30 11 L40 12 L50 7 L60 4",
  },
  {
    label: "Active clients",
    value: <Counter to={14} />,
    trend: "+2 this month",
    up: true,
    spark: "M0 16 L10 14 L20 15 L30 12 L40 10 L50 9 L60 6",
  },
  {
    label: "Conversion rate",
    value: "4.3%",
    trend: "+0.4 pts",
    up: true,
    spark: "M0 14 L10 15 L20 12 L30 13 L40 9 L50 10 L60 7",
  },
  {
    label: "Avg. booking value",
    value: "₹1,230",
    trend: "steady",
    up: false,
    spark: "M0 11 L10 12 L20 10 L30 12 L40 11 L50 10 L60 11",
  },
];

export function StatsGrid() {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Key metrics">
      {STATS.map((s) => (
        <div
          key={s.label}
          className="rounded-[24px] border border-line bg-paper p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-[12px] font-bold uppercase tracking-wider text-faint">{s.label}</div>
            <svg viewBox="0 0 60 22" className="h-[22px] w-[60px] shrink-0 opacity-70" aria-hidden="true">
              <path d={s.spark} fill="none" stroke="var(--color-terra)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="mt-1.5 text-[26px] font-black leading-none tracking-tight">{s.value}</div>
          <div className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11.5px] font-extrabold ${s.up ? "bg-green-soft text-green-deep" : "bg-cream-2 text-muted"}`}>
            {s.up ? "↑ " : ""}
            {s.trend}
          </div>
        </div>
      ))}
    </section>
  );
}
