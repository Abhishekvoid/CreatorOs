/* eslint-disable @next/next/no-img-element */
import SlotRow from "../SlotRow";
import { VerifiedBadge } from "../ui";
import ShareButton from "./ShareButton";

const METRICS = [
  { value: "340+", label: "sessions" },
  { value: "4.9 ★", label: "212 reviews" },
  { value: "120+", label: "clients helped" },
  { value: "5 yrs", label: "experience" },
];

const SOCIALS = [
  {
    label: "LinkedIn",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
        <path d="M4.98 3.5A2.5 2.5 0 1 1 0 3.5a2.5 2.5 0 0 1 4.98 0zM.3 8.3h4.4V24H.3V8.3zm7.6 0h4.2v2.1h.1c.6-1.1 2-2.3 4.2-2.3 4.5 0 5.3 3 5.3 6.8V24h-4.4v-7.9c0-1.9 0-4.3-2.6-4.3s-3 2-3 4.1V24H7.9V8.3z" />
      </svg>
    ),
  },
  {
    label: "Twitter / X",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
        <path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-6.4L6.4 22H3.2l7.3-8.3L1.8 2h6.4l4.4 5.9L18.9 2zm-1.1 18.1h1.7L7.3 3.8H5.5l12.3 16.3z" />
      </svg>
    ),
  },
  {
    label: "Instagram",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4" aria-hidden="true">
        <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
        <circle cx="12" cy="12" r="4.2" />
        <circle cx="17.6" cy="6.4" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    label: "YouTube",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
        <path d="M23 7.2a3 3 0 0 0-2.1-2.2C19 4.5 12 4.5 12 4.5s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.2c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.2A31 31 0 0 0 23.5 12 31 31 0 0 0 23 7.2zM9.8 15.3V8.7l6 3.3-6 3.3z" />
      </svg>
    ),
  },
];

export default function ProfileHeader() {
  return (
    <section className="relative overflow-hidden pb-[clamp(48px,7vw,84px)] pt-[136px] max-md:pt-28">
      {/* ambient gradient washes, same recipe as the landing hero */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(900px 480px at 80% 4%, rgba(242,163,60,.13), transparent 60%), radial-gradient(700px 460px at 8% 40%, rgba(226,85,44,.08), transparent 60%)",
        }}
      />

      <div className="relative mx-auto grid max-w-[1160px] items-center gap-12 px-6 lg:grid-cols-[1.15fr_0.85fr] max-lg:gap-12">
        {/* ---- left: identity ---- */}
        <div className="max-lg:flex max-lg:flex-col max-lg:items-center max-lg:text-center">
          <div className="h-anim flex items-center gap-5 max-lg:flex-col max-lg:gap-4" style={{ animationDelay: "0.05s" }}>
            <div className="relative shrink-0">
              <img
                src="https://randomuser.me/api/portraits/women/68.jpg"
                alt="Meera Shah, career coach"
                className="size-[108px] rounded-full border-4 border-white object-cover shadow-card outline outline-[3px] outline-offset-3 outline-terra"
              />
              <span className="absolute -bottom-0.5 -right-0.5 grid size-8 place-items-center rounded-full border-[3px] border-cream bg-green">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </span>
            </div>
            <div>
              <h1 className="flex items-center gap-2.5 text-[clamp(32px,4.2vw,44px)] font-black leading-none tracking-[-0.025em] max-lg:justify-center">
                Meera Shah <VerifiedBadge />
              </h1>
              <p className="mt-2 text-[16px] font-bold text-ink-2">
                Career Coach <span className="mx-1 text-faint">·</span> ex-Head of Talent, Flipkart
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] font-semibold text-muted max-lg:justify-center">
                <span className="inline-flex items-center gap-1.5">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-3.5" aria-hidden="true">
                    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  Mumbai, India
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-[7px] rounded-full bg-green animate-pulse-dot" />
                  Replies within 2 hours
                </span>
                <span>English · Hindi</span>
              </div>
            </div>
          </div>

          <p
            className="h-anim mt-7 max-w-[540px] text-[clamp(19px,2.2vw,24px)] font-medium leading-snug text-ink-2"
            style={{ animationDelay: "0.15s" }}
          >
            I help mid-career professionals land roles they thought were{" "}
            <span className="font-serif italic text-grad">out of reach</span> — from resume to signed offer.
          </p>

          {/* trust metrics */}
          <div className="h-anim mt-7 flex flex-wrap gap-x-9 gap-y-4 max-lg:justify-center" style={{ animationDelay: "0.25s" }}>
            {METRICS.map((m) => (
              <div key={m.label}>
                <div className="text-[24px] font-black leading-none tracking-tight">{m.value}</div>
                <div className="mt-1 text-[12.5px] font-semibold text-muted">{m.label}</div>
              </div>
            ))}
          </div>

          <div className="h-anim mt-8 flex flex-wrap items-center gap-3.5 max-lg:justify-center" style={{ animationDelay: "0.35s" }}>
            <a href="/meera/book" className="btn btn-grad btn-lg">
              Book a session <span className="arr">→</span>
            </a>
            <ShareButton />
            <div className="flex gap-2 max-lg:w-full max-lg:justify-center">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="grid size-10 place-items-center rounded-full border border-line bg-paper text-muted transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:bg-ink hover:text-cream"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* ---- right: booking card ---- */}
        <div className="relative max-lg:mx-auto max-lg:w-full max-lg:max-w-[440px]">
          <div
            className="h-anim dot-texture absolute -inset-x-[7%] -bottom-[6%] -top-[7%] rounded-[36px] border border-line bg-grad-soft"
            style={{ animationDelay: "0.2s" }}
          />
          <div
            className="h-anim relative rounded-[26px] border border-line bg-paper p-6 shadow-pop"
            style={{ animationDelay: "0.4s" }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="rounded-full bg-grad px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white">
                  ★ Most booked
                </span>
                <h2 className="mt-2.5 text-[19px] font-extrabold tracking-tight">1:1 Career Strategy Call</h2>
                <div className="mt-1 text-[12.5px] font-semibold text-muted">45 min · Google Meet · recorded</div>
              </div>
              <div className="text-right">
                <s className="block text-[13px] font-semibold text-faint">₹1,999</s>
                <b className="text-[26px] font-black leading-none tracking-tight">₹1,499</b>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-[11.5px] font-bold uppercase tracking-wider text-faint">Today · Thu 12 Jun</span>
              <span className="rounded-full bg-[#FDF3DF] px-2.5 py-1 text-[11px] font-extrabold text-[#9A6A14]">
                3 slots left
              </span>
            </div>
            <div className="mt-2.5">
              <SlotRow
                slots={[
                  { time: "11:00 am", taken: true },
                  { time: "2:30 pm", taken: true },
                  { time: "5:00 pm" },
                  { time: "6:30 pm" },
                  { time: "8:00 pm" },
                ]}
                initial={2}
              />
            </div>

            <a href="/meera/book" className="btn btn-primary mt-5 w-full">
              Book for ₹1,499 <span className="arr">→</span>
            </a>
            <p className="mt-3.5 text-center text-[12px] font-semibold text-muted">
              Pay via UPI · instant confirmation on WhatsApp · free reschedule
            </p>
          </div>

          {/* floating proof chip, echoing the landing hero */}
          <div
            className="h-anim absolute -left-[6%] -bottom-[26px] z-2 flex items-center gap-2.5 rounded-2xl border border-line bg-paper py-2.5 pl-3 pr-4 shadow-card animate-float-c max-lg:-bottom-5 max-lg:left-2"
            style={{ animationDelay: "0.6s" }}
          >
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-green-soft text-green">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]" aria-hidden="true">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <div>
              <div className="text-[12.5px] font-extrabold tracking-tight">Rohit booked 5:00 pm</div>
              <div className="text-[11px] font-semibold text-muted">paid via UPI · 4 min ago</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
