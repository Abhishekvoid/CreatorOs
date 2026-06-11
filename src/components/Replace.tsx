import Reveal from "./Reveal";
import { Check, LogoMark, SectionHead } from "./ui";

const OLD_TOOLS = [
  { icon: "🔗", name: "Link-in-bio tool", role: "Pretty links, zero revenue", cost: "₹420/mo", costNote: "and counting" },
  { icon: "📅", name: "Scheduling tool", role: "Bookings, but no payments", cost: "₹830/mo", costNote: "per seat" },
  { icon: "💸", name: "Monetization platform", role: "Takes a cut of every session", cost: "10–20%", costNote: "of your income" },
  { icon: "📲", name: "Manual UPI collection", role: "“Payment done?” screenshots", cost: "Untracked", costNote: "chaos" },
  { icon: "📊", name: "Spreadsheet CRM", role: "Client history, lost weekly", cost: "Hours", costNote: "every week" },
];

const NEW_FEATS = [
  "Bio page with services & prices",
  "Scheduling with calendar sync",
  "UPI payments, settled to you directly",
  "Digital products & client CRM",
];

export default function Replace() {
  return (
    <section id="replace" className="border-y border-line bg-paper py-[clamp(72px,10vw,120px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <SectionHead
            eyebrow="The problem"
            title={
              <>
                You’re running a business on <span className="font-serif italic font-normal">five disconnected apps.</span>
              </>
            }
            sub="A link tool here, a calendar there, payment screenshots on WhatsApp, clients in a spreadsheet — and a platform skimming 15% off every session. CreatorOS replaces the whole stack."
          />
        </Reveal>
        <div className="grid items-center gap-[clamp(20px,4vw,48px)] lg:grid-cols-[1fr_auto_1fr] max-lg:gap-7">
          {/* old fragmented stack */}
          <Reveal className="flex w-full flex-col gap-3 max-lg:mx-auto max-lg:max-w-[520px]">
            {OLD_TOOLS.map((t) => (
              <div key={t.name} className="old-tool flex items-center gap-3.5 rounded-2xl border border-line bg-cream px-4.5 py-[15px]">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-paper text-[17px]">{t.icon}</div>
                <div>
                  <div className="text-[14.5px] font-extrabold tracking-tight">{t.name}</div>
                  <div className="text-xs font-semibold text-faint">{t.role}</div>
                </div>
                <div className="ml-auto whitespace-nowrap text-right text-[12.5px] font-extrabold text-terra-deep">
                  {t.cost}
                  <small className="block text-[10.5px] font-semibold text-faint">{t.costNote}</small>
                </div>
              </div>
            ))}
          </Reveal>

          <Reveal delay={80} className="grid place-items-center text-faint">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className="size-11 max-lg:rotate-90">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Reveal>

          {/* CreatorOS card */}
          <Reveal delay={160} className="w-full max-lg:mx-auto max-lg:max-w-[520px]">
            <div className="glow-tr relative overflow-hidden rounded-[30px] bg-linear-160 from-[#211E17] to-[#191712] to-65% p-8 text-cream shadow-pop">
              <div className="absolute right-5.5 top-5.5 rotate-3 rounded-full bg-grad px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-[0_4px_14px_-2px_rgba(226,85,44,.5)]">
                Save ₹15,000+/yr
              </div>
              <LogoMark className="mb-4.5 size-[46px] rounded-[14px]" />
              <h3 className="mb-1.5 text-2xl font-bold tracking-tight">One link. The whole business.</h3>
              <p className="mb-5.5 text-[14.5px] font-medium text-[#B5B0A4]">
                Everything those five tools do — connected, so a booking becomes a payment, a client record and a
                reminder, automatically.
              </p>
              <div className="mb-6 flex flex-col gap-2.5">
                {NEW_FEATS.map((f) => (
                  <div key={f} className="flex items-center gap-2.5 text-sm font-semibold">
                    <Check className="size-[18px] shrink-0 text-amber" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="flex items-baseline justify-between border-t border-cream/15 pt-4.5">
                <span className="text-[13px] font-semibold text-[#B5B0A4]">Platform commission</span>
                <b className="text-[22px] font-black tracking-tight">
                  ₹0 <em className="ml-1.5 text-xs font-bold not-italic text-amber">forever</em>
                </b>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
