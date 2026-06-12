/* eslint-disable @next/next/no-img-element */
import { ARJUN_AVATAR, KAVYA_AVATAR, PRIYA_AVATAR, ROHIT_AVATAR, SNEHA_AVATAR } from "../persona";

function PanelIcon({ d, className = "size-[18px]" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {d.split("|").map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

/* ---------------- upcoming sessions ---------------- */
const BOOKINGS = [
  {
    img: ROHIT_AVATAR,
    name: "Rohit Sharma",
    service: "Career Strategy Call",
    day: "Today",
    time: "5:00 PM",
    status: "paid" as const,
  },
  {
    img: PRIYA_AVATAR,
    name: "Priya Nair",
    service: "Resume Review",
    day: "Tomorrow",
    time: "11:00 AM",
    status: "paid" as const,
  },
  {
    img: ARJUN_AVATAR,
    name: "Arjun Mehta",
    service: "Mock Interview",
    day: "Fri 14 Jun",
    time: "6:30 PM",
    status: "new" as const,
  },
];

const ROW_ACTIONS = [
  { label: "View", d: "M2.5 12s3.5-7 9.5-7 9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z|M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" },
  { label: "Message", d: "M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2-5.6A8.5 8.5 0 1 1 21 11.5z" },
  { label: "Reschedule", d: "M21 12a9 9 0 1 1-2.6-6.4|M21 3v4h-4" },
];

export function UpcomingBookings() {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Upcoming sessions">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold tracking-tight">Upcoming sessions</h2>
        <a href="#" className="text-[12.5px] font-bold text-muted transition-colors duration-200 hover:text-ink">
          View all →
        </a>
      </div>
      <div className="mt-3 flex flex-col">
        {BOOKINGS.map((b) => (
          <div
            key={b.name}
            className="group -mx-2.5 flex items-center gap-3.5 rounded-2xl px-2.5 py-3.5 transition-colors duration-200 hover:bg-cream max-sm:flex-wrap"
          >
            <img src={b.img} alt={b.name} className="size-10 shrink-0 rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[14px] font-extrabold tracking-tight">{b.name}</div>
              <div className="truncate text-[12.5px] font-semibold text-muted">{b.service}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[13px] font-extrabold">{b.day}</div>
              <div className="text-[12px] font-semibold text-muted">{b.time}</div>
            </div>
            <span className={`badge badge-${b.status} shrink-0`}>{b.status === "paid" ? "Paid" : "New"}</span>
            <div className="flex shrink-0 gap-1 transition-opacity duration-200 sm:opacity-0 sm:group-hover:opacity-100">
              {ROW_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  title={a.label}
                  aria-label={`${a.label} — ${b.name}`}
                  className="grid size-8 place-items-center rounded-xl border border-line bg-paper text-muted transition-all duration-200 hover:border-ink hover:text-ink"
                >
                  <PanelIcon d={a.d} className="size-[15px]" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- quick actions ---------------- */
const ACTIONS = [
  { label: "Create service", tint: "bg-[#FCE9E1] text-terra-deep", d: "M12 5v14M5 12h14" },
  { label: "Add product", tint: "bg-[#FDF3DF] text-[#9A6A14]", d: "M21 8l-9-5-9 5v8l9 5 9-5V8z|M3 8l9 5 9-5" },
  { label: "Share profile", tint: "bg-green-soft text-green-deep", d: "M18 8a3 3 0 1 0-2.9-3.8L8.6 7.6a3 3 0 1 0 0 4.8l6.5 3.4A3 3 0 1 0 18 14l-6.5-3.4a3 3 0 0 0 0-1.2L18 8z" },
  { label: "Block time", tint: "bg-cream-2 text-ink-2", d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M5.6 5.6l12.8 12.8" },
  { label: "Export clients", tint: "bg-[#FCE9E1] text-terra-deep", d: "M12 3v12|M7 10l5 5 5-5|M4 21h16" },
  { label: "Create coupon", tint: "bg-[#FDF3DF] text-[#9A6A14]", d: "M3.5 9V5.5h17V9a2 2 0 0 0 0 6v3.5h-17V15a2 2 0 0 0 0-6z|M13 7.5v1.5M13 11.2v1.6M13 15v1.5" },
];

export function QuickActions() {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Quick actions">
      <h2 className="text-[16px] font-extrabold tracking-tight">Quick actions</h2>
      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-2">
        {ACTIONS.map((a) => (
          <button
            key={a.label}
            className="flex items-center gap-2.5 rounded-2xl border border-line bg-paper px-3.5 py-3 text-left text-[13px] font-bold text-ink-2 transition-all duration-200 hover:-translate-y-0.5 hover:border-ink hover:text-ink hover:shadow-soft"
          >
            <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${a.tint}`}>
              <PanelIcon d={a.d} className="size-4" />
            </span>
            {a.label}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------------- profile performance ---------------- */
const FUNNEL = [
  { label: "Profile views", value: "1,248", pct: 100 },
  { label: "Link clicks", value: "362", pct: 29 },
  { label: "Bookings made", value: "54", pct: 4.3, note: "4.3% conversion" },
];

export function ProfilePerformance() {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Profile performance">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[16px] font-extrabold tracking-tight">Profile performance</h2>
        <span className="text-[11.5px] font-bold text-faint">Last 30 days</span>
      </div>
      <div className="mt-4.5 flex flex-col gap-4">
        {FUNNEL.map((f) => (
          <div key={f.label}>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-muted">{f.label}</span>
              <span className="font-extrabold tracking-tight">
                {f.value}
                {f.note && <span className="ml-1.5 text-[11px] font-bold text-green-deep">{f.note}</span>}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-cream-2">
              <div className="h-full rounded-full bg-grad" style={{ width: `${Math.max(f.pct, 4)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <div className="text-[11.5px] font-bold uppercase tracking-wider text-faint">Top traffic source</div>
        <div className="mt-2 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-xl bg-[#FCE9E1] text-terra-deep">
            <PanelIcon d="M2.5 2.5h19v19h-19z M12 16.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4z M17.6 6.4h.01" className="size-4" />
          </span>
          <span className="text-[14px] font-extrabold tracking-tight">Instagram</span>
          <span className="ml-auto text-[12.5px] font-bold text-muted">61% of views</span>
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {[
            ["WhatsApp", "24%"],
            ["LinkedIn", "9%"],
            ["Direct", "6%"],
          ].map(([n, p]) => (
            <span key={n} className="rounded-full bg-cream px-2.5 py-1 text-[11px] font-bold text-muted">
              {n} {p}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- recent payments ---------------- */
const PAYMENTS = [
  { img: ROHIT_AVATAR, name: "Rohit Sharma", service: "Career Strategy Call", amount: "₹1,499", date: "Today", status: "Paid", tone: "bg-green-soft text-green-deep" },
  { img: PRIYA_AVATAR, name: "Priya Nair", service: "Resume Review", amount: "₹799", date: "Yesterday", status: "Paid", tone: "bg-green-soft text-green-deep" },
  { img: KAVYA_AVATAR, name: "Kavya Reddy", service: "Interview Prep Kit", amount: "₹499", date: "Tue 10 Jun", status: "Paid", tone: "bg-green-soft text-green-deep" },
  { img: SNEHA_AVATAR, name: "Sneha Kulkarni", service: "Resume Review", amount: "₹799", date: "Tue 10 Jun", status: "Failed", tone: "bg-[#FBEAE7] text-[#B3261E]" },
];

export function PaymentsTable() {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Recent payments">
      <div className="flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold tracking-tight">Recent payments</h2>
        <a href="#" className="text-[12.5px] font-bold text-muted transition-colors duration-200 hover:text-ink">
          View all →
        </a>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b border-line text-[11px] font-extrabold uppercase tracking-wider text-faint">
              <th className="py-2.5 pr-3 font-extrabold">Client</th>
              <th className="py-2.5 pr-3 font-extrabold">Service</th>
              <th className="py-2.5 pr-3 font-extrabold">Amount</th>
              <th className="py-2.5 pr-3 font-extrabold">Date</th>
              <th className="py-2.5 text-right font-extrabold">Status</th>
            </tr>
          </thead>
          <tbody>
            {PAYMENTS.map((p) => (
              <tr key={`${p.name}-${p.service}`} className="border-b border-line transition-colors duration-200 last:border-0 hover:bg-cream">
                <td className="py-3 pr-3">
                  <div className="flex items-center gap-2.5">
                    <img src={p.img} alt="" className="size-7 rounded-full object-cover" />
                    <span className="whitespace-nowrap text-[13.5px] font-extrabold tracking-tight">{p.name}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap py-3 pr-3 text-[13px] font-semibold text-muted">{p.service}</td>
                <td className="whitespace-nowrap py-3 pr-3 text-[13.5px] font-extrabold">{p.amount}</td>
                <td className="whitespace-nowrap py-3 pr-3 text-[13px] font-semibold text-muted">{p.date}</td>
                <td className="py-3 text-right">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-extrabold ${p.tone}`}>{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------------- activity feed ---------------- */
const ACTIVITY = [
  { dot: "bg-green", text: <>Payment received — <b className="font-extrabold">₹1,499</b> from Rohit Sharma</>, time: "2 min ago" },
  { dot: "bg-terra", text: <>New booking — Priya Nair, <b className="font-extrabold">Resume Review</b></>, time: "1 hr ago" },
  { dot: "bg-amber", text: <>WhatsApp reminder sent to Arjun Mehta</>, time: "3 hrs ago" },
  { dot: "bg-amber", text: <>Kavya Reddy left a <b className="font-extrabold">★★★★★ review</b></>, time: "Yesterday" },
  { dot: "bg-green", text: <>Calendar invite delivered for Friday&rsquo;s session</>, time: "Yesterday" },
];

export function ActivityFeed() {
  return (
    <section className="rounded-[28px] border border-line bg-paper p-6.5 max-sm:p-5" aria-label="Recent activity">
      <h2 className="text-[16px] font-extrabold tracking-tight">Activity</h2>
      <ul className="relative mt-4 flex flex-col gap-4.5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
        {ACTIVITY.map((a, i) => (
          <li key={i} className="relative pl-6">
            <span className={`absolute left-0 top-1 size-[11px] rounded-full border-2 border-paper ${a.dot}`} />
            <div className="text-[13px] font-semibold leading-snug text-ink-2">{a.text}</div>
            <div className="mt-0.5 text-[11px] font-bold text-faint">{a.time}</div>
          </li>
        ))}
      </ul>
    </section>
  );
}
