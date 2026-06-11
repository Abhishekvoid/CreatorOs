import Reveal from "./Reveal";
import { SectionHead } from "./ui";

const STEPS = [
  {
    num: "01",
    title: "Create your profile",
    copy: "Add your photo, bio, services and prices. Connect your UPI ID and Google Calendar. That’s the whole setup.",
    tag: "~5 minutes",
  },
  {
    num: "02",
    title: "Share your link",
    copy: "Drop creatoros.in/you in your Instagram bio, YouTube description, WhatsApp status — everywhere your audience already is.",
    tag: "One link, everywhere",
  },
  {
    num: "03",
    title: "Get booked & paid",
    copy: "Clients pick a slot and pay by UPI upfront. You get the money, the calendar event, and the client record — automatically.",
    tag: "0% commission",
  },
];

export default function HowItWorks() {
  return (
    <section id="how" className="border-y border-line bg-paper py-[clamp(72px,10vw,120px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <SectionHead
            center
            eyebrow="How it works"
            title={
              <>
                From zero to <span className="font-serif italic font-normal text-grad">paid bookings</span> in an
                afternoon.
              </>
            }
            sub="No website builder, no payment gateway paperwork, no integrations to wire up."
          />
        </Reveal>
        <div className="steps-connector relative grid gap-5 md:grid-cols-3 max-md:gap-11 max-md:before:hidden">
          {STEPS.map((s, i) => (
            <Reveal key={s.num} delay={i * 80}>
              <div className="group/step relative z-1 px-3.5 text-center">
                <div className="step-num relative mx-auto mb-5.5 grid size-[88px] place-items-center rounded-[28px] border border-line bg-cream font-serif text-[34px] italic text-terra-deep shadow-soft">
                  {s.num}
                </div>
                <h3 className="mb-2 text-xl font-bold tracking-tight">{s.title}</h3>
                <p className="mx-auto max-w-[280px] text-[14.5px] font-medium leading-relaxed text-muted">{s.copy}</p>
                <span className="mt-3.5 inline-block rounded-full bg-green-soft px-3 py-1 text-[11.5px] font-extrabold uppercase tracking-wide text-green-deep">
                  {s.tag}
                </span>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
