/* eslint-disable @next/next/no-img-element */
import { ARJUN_AVATAR, KAVYA_AVATAR, PRIYA_AVATAR } from "../persona";
import Reveal from "../Reveal";
import { RatingStars, SectionHead } from "../ui";

const REVIEWS = [
  {
    quote: (
      <>
        After a single session I received <b className="font-extrabold">two interview calls within a week</b>. Meera
        rewired how I told my story — same experience, completely different reaction from recruiters.
      </>
    ),
    stat: "2 interview calls in 7 days",
    img: PRIYA_AVATAR,
    name: "Priya Nair",
    role: "Product Manager · Bengaluru",
    dark: false,
  },
  {
    quote: (
      <>
        The mock interview was harder than the real one. I walked into the actual panel calm, and{" "}
        <b className="font-extrabold">negotiated ₹9 LPA above my old salary</b> using her exact script. Worth every
        rupee, several times over.
      </>
    ),
    stat: "↑ 42% salary at Microsoft",
    img: ARJUN_AVATAR,
    name: "Arjun Mehta",
    role: "Senior Software Engineer · Hyderabad",
    dark: true,
  },
  {
    quote: (
      <>
        I&rsquo;d been cold-applying for a year with nothing. The resume review paid for itself the same month —{" "}
        <b className="font-extrabold">shortlisted at three companies</b> I&rsquo;d given up on, including my dream
        team.
      </>
    ),
    stat: "3 shortlists in a month",
    img: KAVYA_AVATAR,
    name: "Kavya Reddy",
    role: "Marketing Lead · Pune",
    dark: false,
  },
];

export default function ProfileTestimonials() {
  return (
    <section id="reviews" className="pb-[clamp(64px,9vw,110px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <SectionHead
            eyebrow="Client stories"
            title={
              <>
                What happens <span className="font-serif italic font-normal text-grad">after the call.</span>
              </>
            }
          />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {REVIEWS.map((r, i) => (
            <Reveal key={r.name} delay={i * 80} className={r.dark ? "max-md:-order-1" : ""}>
              <div
                className={`flex h-full flex-col gap-4.5 rounded-[30px] border p-7.5 transition-all duration-400 hover:-translate-y-1.5 hover:shadow-card ${
                  r.dark
                    ? "border-[#2E2A21] bg-linear-165 from-[#211E17] to-[#191712] text-cream"
                    : "border-line bg-paper"
                }`}
              >
                <RatingStars className="size-3.5" />
                <p className={`flex-1 text-[15.5px] font-medium leading-relaxed ${r.dark ? "text-[#E8E4D9]" : "text-ink-2"}`}>
                  {r.quote}
                </p>
                <span className="inline-flex self-start rounded-full bg-green-soft px-3 py-1.5 text-xs font-extrabold text-green-deep">
                  {r.stat}
                </span>
                <div className={`flex items-center gap-3 border-t pt-4.5 ${r.dark ? "border-cream/15" : "border-line"}`}>
                  <img src={r.img} alt={r.name} className="size-[46px] rounded-full object-cover" />
                  <div>
                    <div className="text-[14.5px] font-extrabold tracking-tight">{r.name}</div>
                    <div className={`text-[12.5px] font-semibold ${r.dark ? "text-[#9C968A]" : "text-muted"}`}>
                      {r.role}
                    </div>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
