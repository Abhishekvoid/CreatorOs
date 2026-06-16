import Reveal from "../Reveal";
import SlotRow from "../SlotRow";
import { SectionHead } from "../ui";

import { Target, FileText, Mic, Compass, NotebookTabs, Star } from "lucide-react";
type Availability = { label: string; tone: "open" | "limited" | "waitlist" };

const SERVICES: {
  icon: React.ElementType;
  iconBg: string;
  title: string;
  desc: string;
  meta: string[];
  price: string;
  availability: Availability;
}[] = [
  {
    icon: FileText,
    iconBg: "bg-[#FCE9E1]",
    title: "Resume Review",
    desc: "A line-by-line teardown with a recorded video walkthrough, a rewritten summary and an ATS keyword check.",
    meta: ["Async", "48 hr delivery"],
    price: "₹799",
    availability: { label: "Available", tone: "open" },
  },
  {
    icon: Mic,
    iconBg: "bg-[#FDF3DF]",
    title: "Mock Interview",
    desc: "A realistic interview for your target role and level, followed by blunt, specific, actionable feedback.",
    meta: ["60 min", "Google Meet"],
    price: "₹1,999",
    availability: { label: "Available this week", tone: "open" },
  },
  {
    icon: NotebookTabs,
    iconBg: "bg-green-soft",
    title: "Startup Consultation",
    desc: "For founders: hiring plans, career-page audits and offer structuring that wins candidates without overpaying.",
    meta: ["60 min", "Google Meet"],
    price: "₹2,499",
    availability: { label: "2 slots this week", tone: "limited" },
  },
  {
    icon: Compass,
    iconBg: "bg-cream-2",
    title: "Leadership Coaching",
    desc: "A 4-week 1:1 sprint for new managers — delegation, feedback conversations and executive presence.",
    meta: ["4 weeks", "Weekly calls + WhatsApp"],
    price: "₹9,999",
    availability: { label: "Waitlist", tone: "waitlist" },
  },
];

function AvailabilityBadge({ a }: { a: Availability }) {
  const tones = {
    open: "bg-green-soft text-green-deep",
    limited: "bg-[#FDF3DF] text-[#9A6A14]",
    waitlist: "bg-cream-2 text-muted",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${tones[a.tone]}`}
    >
      {a.tone !== "waitlist" && (
        <span className="size-1.5 rounded-full bg-current" />
      )}
      {a.label}
    </span>
  );
}

function ServiceCard({ s }: { s: (typeof SERVICES)[number] }) {
  const Icon = s.icon;
  return (
    <div className="feat relative flex h-full flex-col overflow-hidden rounded-[26px] border border-line bg-paper p-6.5 transition-all duration-400 hover:-translate-y-1.5 hover:shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div
          className={`grid size-12 shrink-0 place-items-center rounded-2xl text-[22px] ${s.iconBg}`}
        >
          <Icon className="h-6 w-6 text-[#1f1a17]" strokeWidth={1.8} />
        </div>
        <AvailabilityBadge a={s.availability} />
      </div>
      <h3 className="mt-4 text-[19px] font-extrabold tracking-tight">
        {s.title}
      </h3>
      <p className="mt-1.5 flex-1 text-sm font-medium leading-relaxed text-muted">
        {s.desc}
      </p>
      <div className="mt-4 flex flex-wrap gap-1.5">
        {s.meta.map((m) => (
          <span
            key={m}
            className="rounded-full border border-line bg-cream px-2.5 py-1 text-[12px] font-bold text-ink-2"
          >
            {m}
          </span>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between border-t border-line pt-4.5">
        <b className="text-[22px] font-black tracking-tight">{s.price}</b>
        <a
          href="/meera/book"
          className="btn btn-primary !px-5 !py-2.5 !text-[13.5px]"
        >
          Book now
        </a>
      </div>
    </div>
  );
}

export default function Services() {
  return (
    <section id="services" className="py-[clamp(64px,9vw,110px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <SectionHead
            eyebrow="Work with Meera"
            title={
              <>
                Pick a session.{" "}
                <span className="font-serif italic font-normal text-grad">
                  Leave with a plan.
                </span>
              </>
            }
            sub="Every 1:1 comes with a recording, written notes and a follow-up action plan."
          />
        </Reveal>

        <div className="grid gap-5 lg:grid-cols-3">
          {/* featured service — dark, dominant */}
          <Reveal className="lg:col-span-2">
            <div className="glow-tr relative flex h-full flex-col overflow-hidden rounded-[30px] border border-[#2E2A21] bg-linear-165 from-[#211E17] to-[#191712] p-7.5 text-cream shadow-pop transition-all duration-400 hover:-translate-y-1.5">
              <div className="relative grid gap-7 md:grid-cols-[1.15fr_1fr]">
                <div className="flex flex-col">
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-grad px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white shadow-[0_4px_14px_-4px_rgba(226,85,44,.6)]">
                      <Star className="size-3 text-white" fill="currentColor" strokeWidth={0} aria-hidden="true" /> Most popular
                    </span>
                    <span className="text-[12px] font-bold text-[#9C968A]">
                      booked 41× this month
                    </span>
                  </div>
                  <div className="mt-5 flex items-center gap-3.5">
                    <div className="grid size-13 shrink-0 place-items-center rounded-2xl bg-cream/10 text-[24px]">
                      <Target
                        className="h-7 w-7 text-[#F2A33C]"
                        strokeWidth={1.8}
                      />
                    </div>
                    <h3 className="text-[clamp(22px,2.4vw,27px)] font-extrabold tracking-tight">
                      1:1 Career Strategy Call
                    </h3>
                  </div>
                  <p className="mt-3.5 flex-1 text-[15px] font-medium leading-relaxed text-[#C9C4B8]">
                    A focused 45 minutes on your career: where you&rsquo;re
                    stuck, what you&rsquo;re actually worth, and the exact next
                    three moves. You leave with a written plan — not vague
                    advice.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {[
                      "45 min",
                      "Google Meet",
                      "Recording included",
                      "English · Hindi",
                    ].map((m) => (
                      <span
                        key={m}
                        className="rounded-full border border-cream/15 bg-cream/5 px-2.5 py-1 text-[12px] font-bold text-[#D9D5CA]"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col rounded-[22px] border border-cream/12 bg-cream/5 p-5">
                  <div>
                    <div className="flex items-end gap-2">
                      <s className="mb-1 text-[16px] font-semibold text-[#8E897D]">
                        ₹1,999
                      </s>

                      <b className="leading-none text-[52px] font-black tracking-tight">
                        ₹1,499
                      </b>
                    </div>

                    <p className="mt-2 text-[13px] font-semibold text-amber">
                      Only 3 slots left today
                    </p>
                  </div>
                  <div className="mt-4 text-[11px] font-bold uppercase tracking-wider text-[#8E897D]">
                    Today · Thu 12 Jun
                  </div>
                  <div className="mt-2 [&_.slot]:border-cream/15 [&_.slot]:bg-transparent [&_.slot]:text-[#D9D5CA] [&_.slot:hover]:border-amber [&_.slot:hover]:text-amber [&_.slot-sel]:!border-cream [&_.slot-sel]:!bg-cream [&_.slot-sel]:!text-ink">
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
                  <a href="/meera/book" className="btn btn-grad mt-5 w-full">
                    Book now <span className="arr">→</span>
                  </a>
                  <p className="mt-3 text-center text-[11.5px] font-semibold text-[#8E897D]">
                    UPI · instant WhatsApp confirmation
                  </p>
                </div>
              </div>
            </div>
          </Reveal>

          {SERVICES.map((s, i) => (
            <Reveal key={s.title} delay={(i % 3) * 80}>
              <ServiceCard s={s} />
            </Reveal>
          ))}

          {/* helper strip for the undecided */}
          <Reveal className="lg:col-span-3">
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[22px] border-[1.5px] border-dashed border-line-2 px-6.5 py-5 max-md:justify-center max-md:text-center">
              <p className="text-[15px] font-semibold text-ink-2">
                Not sure where to start?{" "}
                <span className="text-muted">
                  Tell me your situation and I&rsquo;ll point you to the right
                  session — free.
                </span>
              </p>
              <a
                href="#"
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-wa/40 bg-green-soft px-5 py-2.5 text-[14px] font-bold text-green-deep transition-all duration-300 hover:-translate-y-0.5 hover:border-wa hover:shadow-soft"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-[17px]"
                  aria-hidden="true"
                >
                  <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2zm5.4 14.1c-.2.7-1.3 1.3-1.9 1.4-.5.1-1.1.2-3.4-.7-2.8-1.2-4.7-4-4.8-4.2-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .7.5.2.6.8 2 .9 2.1.1.2.1.4 0 .6-.4.9-.9 1-.6 1.5.9 1.5 2 2.4 3.4 3 .4.2.6.2.8 0 .2-.2.9-1 1.1-1.3.2-.3.5-.3.8-.2.3.1 1.9.9 2.2 1.1.3.2.5.3.6.4 0 .2 0 .9-.2 1.6z" />
                </svg>
                Message on WhatsApp
              </a>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
