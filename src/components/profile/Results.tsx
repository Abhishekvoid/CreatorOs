import Counter from "../Counter";
import Reveal from "../Reveal";
import { RatingStars } from "../ui";

const STATS: { value: React.ReactNode; label: string; note: React.ReactNode }[] = [
  {
    value: (
      <>
        <Counter to={340} />+
      </>
    ),
    label: "sessions conducted",
    note: "across 6 countries",
  },
  {
    value: (
      <>
        <Counter to={120} />+
      </>
    ),
    label: "clients helped",
    note: "ICs to VPs",
  },
  {
    value: (
      <>
        <Counter to={35} />%
      </>
    ),
    label: "avg. salary increase",
    note: "within 6 months",
  },
  {
    value: "4.9",
    label: "average rating",
    note: <span className="inline-flex items-center gap-1.5"><RatingStars className="size-3" /> · 212 reviews</span>,
  },
];

export default function Results() {
  return (
    <section id="results" className="py-[clamp(64px,9vw,110px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <div className="glow-top relative overflow-hidden rounded-[clamp(26px,4vw,40px)] bg-linear-160 from-[#241F16] to-[#191712] to-60% px-[clamp(24px,5vw,72px)] py-[clamp(44px,6vw,72px)] text-cream shadow-pop">
            <div className="relative z-1 mb-[clamp(32px,4vw,48px)] max-w-[560px]">
              <h2 className="text-[clamp(28px,3.8vw,40px)] font-bold leading-[1.1] tracking-[-0.025em]">
                Outcomes, <span className="font-serif italic font-normal">not just conversations.</span>
              </h2>
              <p className="mt-3.5 text-[15.5px] font-medium text-[#B5B0A4]">
                Numbers from the last 12 months, pulled straight from the booking dashboard.
              </p>
            </div>
            <div className="relative z-1 grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-4">
              {STATS.map((s, i) => (
                <div key={s.label} className={i > 0 ? "lg:border-l lg:border-cream/12 lg:pl-8" : ""}>
                  <div className="text-[clamp(38px,4.4vw,52px)] font-black leading-none tracking-tighter">
                    {s.value}
                  </div>
                  <div className="mt-2.5 text-[14.5px] font-bold text-[#D9D5CA]">{s.label}</div>
                  <div className="mt-1 text-[12.5px] font-semibold text-[#8E897D]">{s.note}</div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
