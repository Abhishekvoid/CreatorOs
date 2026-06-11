import Reveal from "./Reveal";
import { Check, Cross, SectionHead } from "./ui";

type Feature = { text: string; included: boolean };

function PlanFeature({ f, dark }: { f: Feature; dark: boolean }) {
  return (
    <li
      className={`flex items-start gap-2.5 text-sm font-semibold ${
        f.included ? (dark ? "text-[#D9D5CA]" : "text-ink-2") : "opacity-45"
      } ${!f.included ? (dark ? "text-[#D9D5CA]" : "text-ink-2") : ""}`}
    >
      {f.included ? <Check /> : <Cross />}
      {f.text}
    </li>
  );
}

export default function Pricing() {
  return (
    <section id="pricing" className="border-y border-line bg-paper py-[clamp(72px,10vw,120px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <SectionHead
            center
            eyebrow="Pricing"
            title={
              <>
                Flat pricing. <span className="font-serif italic font-normal text-grad">Never a commission.</span>
              </>
            }
            sub="Platforms taking 10–20% punish you for growing. We charge a flat fee — earn ₹10,000 or ₹10,00,000, it’s yours."
          />
        </Reveal>

        <div className="grid items-stretch gap-5 lg:grid-cols-3 max-lg:mx-auto max-lg:max-w-[460px]">
          {/* Free */}
          <Reveal>
            <div className="flex h-full flex-col rounded-[30px] border border-line bg-cream px-7.5 py-8.5 transition-all duration-400 hover:-translate-y-1.5 hover:shadow-card">
              <div className="text-[17px] font-extrabold tracking-tight">Free</div>
              <div className="mb-5 mt-1 text-[13px] font-semibold text-muted">For getting your first bookings</div>
              <div className="flex items-baseline gap-1.5">
                <b className="text-[44px] font-black tracking-tighter">₹0</b>
                <span className="text-sm font-semibold text-muted">/ forever</span>
              </div>
              <div className="mb-5.5 mt-1 self-start rounded-full bg-green-soft px-2.5 py-1 text-xs font-bold text-green-deep">
                0% commission, even on free
              </div>
              <ul className="mb-7 flex flex-1 flex-col gap-3">
                {[
                  { text: "Public profile + your creatoros.in link", included: true },
                  { text: "1 service · unlimited bookings", included: true },
                  { text: "UPI payments with instant settlement", included: true },
                  { text: "Google Calendar sync", included: true },
                  { text: "WhatsApp automation", included: false },
                  { text: "Client CRM & digital products", included: false },
                ].map((f) => (
                  <PlanFeature key={f.text} f={f} dark={false} />
                ))}
              </ul>
              <a href="#final" className="btn btn-ghost w-full">Start free</a>
            </div>
          </Reveal>

          {/* Founding (highlighted) */}
          <Reveal delay={80}>
            <div className="relative flex h-full flex-col rounded-[30px] border border-[#2E2A21] bg-linear-170 from-[#211E17] to-[#191712] px-7.5 py-8.5 text-cream shadow-pop lg:scale-[1.035] z-1 transition-all duration-400 hover:-translate-y-1.5">
              <div className="absolute -top-[15px] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-grad px-4.5 py-[7px] text-[11.5px] font-extrabold uppercase tracking-wide text-white shadow-[0_6px_18px_-4px_rgba(226,85,44,.55)]">
                ★ Founding member — price locked forever
              </div>
              <div className="text-[17px] font-extrabold tracking-tight">Founding</div>
              <div className="mb-5 mt-1 text-[13px] font-semibold text-[#9C968A]">For creators ready to go full-time</div>
              <div className="flex items-baseline gap-1.5">
                <s className="mr-0.5 text-[17px] font-semibold text-faint">₹699</s>
                <b className="text-[44px] font-black tracking-tighter">₹299</b>
                <span className="text-sm font-semibold text-[#9C968A]">/ month</span>
              </div>
              <div className="mb-5.5 mt-1 self-start rounded-full bg-green/20 px-2.5 py-1 text-xs font-bold text-[#7BD3AC]">
                First 1,000 creators only
              </div>
              <ul className="mb-7 flex flex-1 flex-col gap-3">
                {[
                  "Everything in Free, plus —",
                  "Unlimited services & digital products",
                  "WhatsApp confirmations & reminders",
                  "Client CRM with history, notes & tags",
                  "Revenue analytics & GST invoices",
                  "Custom domain",
                ].map((text) => (
                  <PlanFeature key={text} f={{ text, included: true }} dark />
                ))}
              </ul>
              <a href="#final" className="btn btn-grad w-full">
                Lock in ₹299/mo <span className="arr">→</span>
              </a>
            </div>
          </Reveal>

          {/* Pro */}
          <Reveal delay={160}>
            <div className="flex h-full flex-col rounded-[30px] border border-line bg-cream px-7.5 py-8.5 transition-all duration-400 hover:-translate-y-1.5 hover:shadow-card">
              <div className="text-[17px] font-extrabold tracking-tight">Pro</div>
              <div className="mb-5 mt-1 text-[13px] font-semibold text-muted">For teams &amp; high-volume creators</div>
              <div className="flex items-baseline gap-1.5">
                <b className="text-[44px] font-black tracking-tighter">₹699</b>
                <span className="text-sm font-semibold text-muted">/ month</span>
              </div>
              <div className="mb-5.5 mt-1 self-start rounded-full bg-green-soft px-2.5 py-1 text-xs font-bold text-green-deep">
                Still 0% commission
              </div>
              <ul className="mb-7 flex flex-1 flex-col gap-3">
                {[
                  "Everything in Founding, plus —",
                  "Team scheduling (up to 5 members)",
                  "Advanced funnels & conversion analytics",
                  "API access & webhooks",
                  "Priority support on WhatsApp",
                ].map((text) => (
                  <PlanFeature key={text} f={{ text, included: true }} dark={false} />
                ))}
              </ul>
              <a href="#final" className="btn btn-primary w-full">Go Pro</a>
            </div>
          </Reveal>
        </div>

        <Reveal>
          <p className="mt-8.5 text-center text-[13.5px] font-semibold text-muted">
            <Check className="mr-1 inline size-[15px] align-[-3px] text-green" />
            No credit card to start &nbsp;·&nbsp; Cancel anytime &nbsp;·&nbsp; Your link &amp; data are always yours
          </p>
        </Reveal>
      </div>
    </section>
  );
}
