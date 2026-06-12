import { ROHIT_AVATAR } from "./persona";
import Reveal from "./Reveal";
import SlotRow from "./SlotRow";
import { Check, SectionHead } from "./ui";

function FeatureCard({
  delay,
  icon,
  iconClass,
  title,
  copy,
  micro,
  children,
}: {
  delay?: number;
  icon: React.ReactNode;
  iconClass: string;
  title: string;
  copy: string;
  micro: string[];
  children: React.ReactNode;
}) {
  return (
    <Reveal delay={delay}>
      <div className="feat group relative h-full overflow-hidden rounded-[30px] border border-line bg-paper p-[clamp(26px,3.4vw,38px)] transition-all duration-400 hover:-translate-y-1.5 hover:border-line-2 hover:shadow-card">
        <div
          className={`mb-5 grid size-13 place-items-center rounded-2xl transition-transform duration-400 ease-spring group-hover:-rotate-6 group-hover:scale-108 ${iconClass}`}
        >
          {icon}
        </div>
        <h3 className="mb-2 text-[22px] font-bold tracking-tight">{title}</h3>
        <p className="mb-4.5 max-w-[420px] text-[15px] font-medium leading-relaxed text-muted">{copy}</p>
        <div className="flex flex-wrap gap-2">
          {micro.map((m) => (
            <span
              key={m}
              className="rounded-full border border-line bg-cream px-3 py-1.5 text-xs font-bold text-ink-2 transition-colors group-hover:border-line-2"
            >
              {m}
            </span>
          ))}
        </div>
        <div className="mt-5.5 border-t border-dashed border-line-2 pt-4.5">{children}</div>
      </div>
    </Reveal>
  );
}

export default function Features() {
  return (
    <section id="features" className="py-[clamp(72px,10vw,120px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <SectionHead
            eyebrow="What you get"
            title={
              <>
                Built around the two things that matter:{" "}
                <span className="font-serif italic font-normal text-grad">bookings &amp; payments.</span>
              </>
            }
            sub="Not another link page with buttons. Every feature exists to turn your audience into paid, scheduled, repeat clients."
          />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-2">
          <FeatureCard
            iconClass="bg-[#FCE9E1] text-terra-deep"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[25px]">
                <rect x="3" y="4" width="18" height="18" rx="3" />
                <path d="M16 2v4M8 2v4M3 10h18M9.5 15.5l1.8 1.8 3.5-3.8" />
              </svg>
            }
            title="Bookings that run themselves"
            copy="Set your hours once. Clients pick a slot, pay upfront, and it lands on your calendar — no DMs, no back-and-forth, no double bookings."
            micro={["Google Calendar sync", "Buffers & limits", "Reschedule links", "Time-zone smart"]}
          >
            <SlotRow
              initial={2}
              slots={[
                { time: "10:00 am", taken: true },
                { time: "11:30 am" },
                { time: "5:00 pm" },
                { time: "6:30 pm" },
                { time: "8:00 pm", taken: true },
              ]}
            />
          </FeatureCard>

          <FeatureCard
            delay={80}
            iconClass="bg-green-soft text-green-deep"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[25px]">
                <rect x="2" y="5" width="20" height="14" rx="3" />
                <path d="M2 10h20M6 15h4" />
              </svg>
            }
            title="UPI payments, 0% commission"
            copy="Clients pay by UPI before the session. Money settles to your account directly — no platform cut, no chasing, no “payment done?” screenshots."
            micro={["Instant settlement", "Auto receipts", "Refund controls", "GST-ready invoices"]}
          >
            <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-cream px-3.5 py-3">
              <div className="grid size-[34px] shrink-0 place-items-center rounded-full bg-green-soft text-green">
                <Check className="size-4 text-green" />
              </div>
              <div>
                <div className="text-sm font-extrabold">₹1,499 · Ananya S.</div>
                <div className="text-[11.5px] font-semibold text-muted">UPI · ananya@okhdfc · 2 sec ago</div>
              </div>
              <span className="badge badge-paid ml-auto">You keep ₹1,499</span>
            </div>
          </FeatureCard>

          <FeatureCard
            iconClass="bg-[#FDF3DF] text-[#9A6A14]"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[25px]">
                <path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9.5" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            }
            title="A CRM that fills itself"
            copy="Every booking builds your client book automatically — session history, payments, notes and tags. Know exactly who your best clients are."
            micro={["Full session history", "Notes & tags", "Repeat-client view", "CSV export"]}
          >
            <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-cream px-3.5 py-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={ROHIT_AVATAR} alt="" className="size-8 rounded-full object-cover" />
              <div>
                <div className="text-[13px] font-bold">Rohit Sharma</div>
                <div className="text-[11px] font-semibold text-faint">6 sessions · ₹8,994 lifetime</div>
              </div>
              <div className="ml-auto flex gap-1.5">
                <span className="badge badge-paid">Repeat</span>
                <span className="badge badge-new">VIP</span>
              </div>
            </div>
          </FeatureCard>

          <FeatureCard
            delay={80}
            iconClass="bg-green-soft text-wa"
            icon={
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="size-[25px]">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.7 8.7 0 0 1-3.8-.9L3 20l1-5a8.4 8.4 0 1 1 17-3.5z" />
                <path d="M8.5 10.5h.01M12 10.5h.01M15.5 10.5h.01" />
              </svg>
            }
            title="WhatsApp automation that kills no-shows"
            copy="Confirmations, reminders, payment links and follow-ups go out on WhatsApp automatically — where your clients actually read messages."
            micro={["Booking confirmations", "24h + 1h reminders", "Payment nudges", "Review requests"]}
          >
            <div className="max-w-[330px] rounded-2xl rounded-bl-[5px] border border-[#CDEBD9] bg-[#E9F8EF] px-4 py-3 text-[12.5px] font-semibold leading-normal text-[#1D4B33]">
              Hi Rohit! 👋 Reminder: your <b className="font-extrabold">1:1 Career Strategy Call</b> with Meera is{" "}
              <b className="font-extrabold">tomorrow at 11:00 am</b>. Join link: meet.creatoros.in/rohit
              <div className="mt-1 text-right text-[10px] font-bold text-[#6FA388]">Sent automatically · 10:58 am ✓✓</div>
            </div>
          </FeatureCard>
        </div>
      </div>
    </section>
  );
}
