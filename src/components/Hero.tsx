import Counter from "./Counter";
import { ANANYA_AVATAR, MEERA_AVATAR, ROHIT_AVATAR } from "./persona";
import { VerifiedBadge } from "./ui";
import { Target, FileText, BookOpen, Star, type LucideIcon } from "lucide-react";

import Link from "next/link";

function ServiceRow({
  icon: Icon,
  iconBg,
  title,
  meta,
  price,
  note,
}: {
  icon: LucideIcon;
  iconBg: string;
  title: string;
  meta: string;
  price: string;
  note?: string;
}) {
  return (
    <div className="mt-2.5 flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-cream p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-line-2 hover:shadow-soft">
      <div className={`grid size-9 shrink-0 place-items-center rounded-[11px] ${iconBg}`}>
        <Icon className="size-[18px] text-ink" strokeWidth={2} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12.5px] font-bold tracking-tight">{title}</div>
        <div className="text-[10.5px] font-semibold text-faint">{meta}</div>
      </div>
      <div className="whitespace-nowrap text-[13px] font-extrabold">
        {price}
        {note && <small className="block text-right text-[9px] font-bold text-green">● {note}</small>}
      </div>
    </div>
  );
}

export default function Hero() {
  return (
    <section className="relative overflow-hidden pb-[90px] pt-[160px] max-md:pt-32">
      {/* ambient gradient washes */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 480px at 78% 8%, rgba(242,163,60,.13), transparent 60%), radial-gradient(700px 460px at 12% 30%, rgba(226,85,44,.08), transparent 60%)",
        }}
      />
      <div className="relative mx-auto grid max-w-[1160px] items-center gap-12 px-6 lg:grid-cols-[1.02fr_1fr] max-lg:gap-15">
        {/* ---- left: copy ---- */}
        <div className="max-lg:flex max-lg:flex-col max-lg:items-center max-lg:text-center">
          <a
            href="#pricing"
            className="h-anim mb-6.5 inline-flex items-center gap-2 rounded-full border border-line bg-paper py-1.5 pl-2 pr-4 text-[13.5px] font-semibold text-ink-2 shadow-soft transition-all hover:-translate-y-px hover:border-terra"
            style={{ animationDelay: "0.05s" }}
          >
            <span className="rounded-full bg-grad px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white">
              New
            </span>
            <span className="size-[7px] rounded-full bg-green animate-pulse-dot" />
            Founding-member pricing is live — 0% commission, forever
          </a>
          <h1
            className="h-anim mb-5 text-[clamp(40px,5.6vw,64px)] font-black leading-[1.1] tracking-[-0.025em] max-md:text-[clamp(34px,9.4vw,44px)]"
            style={{ animationDelay: "0.15s" }}
          >
            Run your entire creator business from{" "}
            <span className="font-serif italic font-normal text-grad">one&nbsp;link.</span>
          </h1>
          <p
            className="h-anim mb-8 max-w-[520px] text-[clamp(16.5px,1.8vw,19px)] font-medium leading-relaxed text-muted"
            style={{ animationDelay: "0.25s" }}
          >
            Bookings, <b className="font-bold text-ink-2">UPI payments</b>, digital products, client CRM and
            WhatsApp reminders — everything you duct-tape together today, in one calm place.{" "}
            <b className="font-bold text-ink-2">You keep 100% of what you earn.</b>
          </p>
          <div className="h-anim mb-8 flex flex-wrap gap-3.5 max-lg:justify-center" style={{ animationDelay: "0.35s" }}>
            <a href="#" className="btn btn-grad btn-lg">
              Claim your free link <span className="arr">→</span>
            </a>
            <Link href="/demo" className="btn btn-ghost btn-lg">
              See how it works
            </Link>
          </div>
          <div className="h-anim flex flex-col gap-3 max-lg:items-center" style={{ animationDelay: "0.45s" }}>
            <div className="text-sm font-semibold text-muted">
              <b className="text-ink">Founding cohort open</b> — first 1,000 creators lock ₹299/mo forever
            </div>
            <div className="flex flex-wrap gap-2 max-lg:justify-center">
              {["0% commission, ever", "UPI-native", "Made in India"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs font-bold text-ink-2"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ---- right: product showcase ---- */}
        <div className="relative min-h-[560px] w-full max-lg:mx-auto max-lg:max-w-[640px] max-md:min-h-0">
          <div
            className="h-anim dot-texture absolute -inset-x-[4%] bottom-[2%] top-[6%] rounded-[40px] border border-line bg-grad-soft max-md:-inset-x-[6%] max-md:inset-y-[2%]"
            style={{ animationDelay: "0.05s", animationDuration: "1.1s" }}
          />

          {/* dashboard card */}
          <div
            className="h-anim md:absolute md:-right-[2%] md:top-[1%] md:w-[400px] md:animate-float-b relative max-md:-mb-10 max-md:w-full overflow-hidden rounded-[22px] border border-line bg-paper shadow-pop z-2"
            style={{ animationDelay: "0.35s", animationDuration: "1.1s" }}
          >
            <div className="flex items-center gap-[7px] border-b border-line px-4 py-3">
              <i className="size-[9px] rounded-full bg-[#F4BFAD]" />
              <i className="size-[9px] rounded-full bg-line-2" />
              <i className="size-[9px] rounded-full bg-line-2" />
              <span className="ml-auto text-[11px] font-bold text-faint">creatoros.in/dashboard</span>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-2xl border border-line bg-cream px-3.5 py-3">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Revenue · June</div>
                  <div className="mt-0.5 text-[21px] font-black tracking-tight">
                    ₹<Counter to={84500} />
                  </div>
                  <div className="mt-0.5 text-[10.5px] font-bold text-green">↑ 23% vs May</div>
                </div>
                <div className="rounded-2xl border border-line bg-cream px-3.5 py-3">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Bookings</div>
                  <div className="mt-0.5 text-[21px] font-black tracking-tight">
                    <Counter to={47} />
                  </div>
                  <div className="mt-0.5 text-[10.5px] font-bold text-green">↑ 12 this week</div>
                </div>
              </div>
              <div className="mt-3.5 rounded-2xl border border-line bg-cream px-3.5 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10.5px] font-bold uppercase tracking-wider text-faint">Earnings trend</span>
                  <em className="rounded-full bg-green-soft px-2 py-0.5 text-[10.5px] font-bold not-italic text-green">
                    0% fees
                  </em>
                </div>
                <svg viewBox="0 0 320 56" preserveAspectRatio="none" className="h-14 w-full" aria-hidden="true">
                  <defs>
                    <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#E2552C" stopOpacity=".22" />
                      <stop offset="1" stopColor="#E2552C" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    className="spark-area"
                    fill="url(#sparkfill)"
                    d="M0,46 C30,42 48,30 72,32 C100,34 118,18 150,20 C180,22 200,12 232,14 C260,16 288,7 320,4 L320,56 L0,56 Z"
                  />
                  <path
                    className="spark-line"
                    d="M0,46 C30,42 48,30 72,32 C100,34 118,18 150,20 C180,22 200,12 232,14 C260,16 288,7 320,4"
                  />
                </svg>
              </div>
              <div className="mt-3.5">
                {[
                  { img: ANANYA_AVATAR, name: "Ananya S.", time: "Today · 5:00 pm", badge: "paid", label: "Paid" },
                  { img: ROHIT_AVATAR, name: "Rohit K.", time: "Tomorrow · 11 am", badge: "new", label: "New" },
                ].map((r) => (
                  <div key={r.name} className="flex items-center gap-2.5 border-t border-line px-1 py-2 text-xs">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.img} alt="" className="size-[26px] rounded-full object-cover" />
                    <span className="flex-1 font-bold">{r.name}</span>
                    <span className="text-[11px] font-semibold text-faint">{r.time}</span>
                    <span className={`badge badge-${r.badge}`}>{r.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* phone: public profile */}
          <div
            className="h-anim relative z-3 mx-auto w-[286px] rounded-[34px] border border-line bg-paper p-3.5 shadow-pop md:absolute md:left-[2%] md:top-[6%] md:mx-0 md:animate-float-a"
            style={{ animationDelay: "0.5s", animationDuration: "1.1s" }}
          >
            <div className="mx-auto mb-3.5 mt-0.5 h-[5px] w-[84px] rounded-full bg-line-2" />
            <div className="flex flex-col items-center px-2 pb-3.5 pt-1.5 text-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={MEERA_AVATAR}
                alt="Meera Shah"
                className="mb-2.5 size-16 rounded-full border-[3px] border-white object-cover outline outline-[2.5px] outline-offset-2 outline-terra"
              />
              <div className="flex items-center gap-1.5 text-[16.5px] font-extrabold tracking-tight">
                Meera Shah <VerifiedBadge />
              </div>
              <div className="mt-0.5 text-xs font-medium text-muted">Career coach · Resume to offer letter</div>
              <div className="mt-2.5 flex gap-3.5 text-[11px] font-semibold text-faint">
                <span><b className="text-[12.5px] text-ink">340+</b> sessions</span>
                <span className="inline-flex items-center gap-1"><b className="text-[12.5px] text-ink">4.9</b> <Star className="size-3 text-amber" fill="currentColor" strokeWidth={0} aria-hidden="true" /> rating</span>
                <span><b className="text-[12.5px] text-ink">5 yrs</b> exp</span>
              </div>
            </div>
            <ServiceRow icon={Target} iconBg="bg-[#FCE9E1]" title="1:1 Career Strategy Call" meta="45 min · Google Meet" price="₹1,499" note="slots open" />
            <ServiceRow icon={FileText} iconBg="bg-[#FDF3DF]" title="Resume Review" meta="Async · 48 hr delivery" price="₹799" note="popular" />
            <ServiceRow icon={BookOpen} iconBg="bg-green-soft" title="Interview Prep Kit" meta="Digital download" price="₹499" note="instant" />
            <div className="mt-3 w-full rounded-full bg-ink py-2.5 text-center text-[13px] font-bold text-cream">
              Book a session →
            </div>
          </div>

          {/* floating chips */}
          <div
            className="h-anim absolute bottom-[14%] right-[6%] z-4 flex items-center gap-2.5 rounded-2xl border border-line bg-paper py-2.5 pl-3 pr-4 shadow-card animate-float-c max-md:right-0 max-md:top-[30%] max-md:bottom-auto"
            style={{ animationDelay: "0.65s", animationDuration: "1.1s" }}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-green-soft text-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]"><path d="M20 6L9 17l-5-5" /></svg>
            </div>
            <div>
              <div className="text-[12.5px] font-extrabold tracking-tight">₹1,499 received</div>
              <div className="text-[11px] font-semibold text-muted">UPI · just now · 0% fee</div>
            </div>
          </div>
          <div
            className="h-anim absolute -left-[3%] bottom-[4%] z-4 flex items-center gap-2.5 rounded-2xl border border-line bg-paper py-2.5 pl-3 pr-4 shadow-card animate-float-c max-md:left-0 max-md:bottom-[8%]"
            style={{ animationDelay: "0.8s", animationDuration: "1.1s" }}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#FCE9E1] text-terra">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
            </div>
            <div>
              <div className="text-[12.5px] font-extrabold tracking-tight">New booking confirmed</div>
              <div className="text-[11px] font-semibold text-muted">Fri, 5:00 pm · auto-reminder sent</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
