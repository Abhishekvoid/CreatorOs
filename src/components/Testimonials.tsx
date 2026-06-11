import Reveal from "./Reveal";
import { SectionHead } from "./ui";

const STORIES = [
  {
    quote: (
      <>
        I was paying for three tools and still chasing payments on WhatsApp. Now clients book and pay before I even
        see the notification. <b className="font-extrabold">My no-show rate went from 30% to almost zero</b> because
        everything is paid upfront.
      </>
    ),
    stat: "↑ 2.1× monthly revenue",
    img: "https://randomuser.me/api/portraits/men/75.jpg",
    name: "Vikram Iyer",
    role: "Fitness coach · Bengaluru",
    dark: false,
  },
  {
    quote: (
      <>
        The 15% commission on my old platform was quietly eating ₹12,000 a month.{" "}
        <b className="font-extrabold">With CreatorOS I keep every rupee</b> — and the WhatsApp reminders mean I
        haven’t manually confirmed a session in months. It genuinely runs itself.
      </>
    ),
    stat: "₹1.4L+ saved in fees this year",
    img: "https://randomuser.me/api/portraits/women/68.jpg",
    name: "Meera Shah",
    role: "Career coach · Mumbai",
    dark: true,
  },
  {
    quote: (
      <>
        I tutor 40 students a week and used to track everything in a spreadsheet. The CRM builds itself now —{" "}
        <b className="font-extrabold">I can see every student’s history, payments and notes in one tap.</b> Parents
        love the automatic reminders too.
      </>
    ),
    stat: "8 hrs/week back",
    img: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Sneha Kulkarni",
    role: "Maths tutor & consultant · Pune",
    dark: false,
  },
];

export default function Testimonials() {
  return (
    <section id="stories" className="pb-[clamp(72px,10vw,120px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <SectionHead eyebrow="Creator stories" title="They switched. Their revenue noticed." />
        </Reveal>
        <div className="grid gap-5 md:grid-cols-3">
          {STORIES.map((s, i) => (
            <Reveal key={s.name} delay={i * 80} className={s.dark ? "max-md:-order-1" : ""}>
              <div
                className={`flex h-full flex-col gap-4.5 rounded-[30px] border p-7.5 transition-all duration-400 hover:-translate-y-1.5 hover:shadow-card ${
                  s.dark
                    ? "border-[#2E2A21] bg-linear-165 from-[#211E17] to-[#191712] text-cream"
                    : "border-line bg-paper"
                }`}
              >
                <div className="h-6 font-serif text-[52px] italic leading-[0.6] text-terra">“</div>
                <p className={`flex-1 text-[15.5px] font-medium leading-relaxed ${s.dark ? "text-[#E8E4D9]" : "text-ink-2"}`}>
                  {s.quote}
                </p>
                <span className="inline-flex self-start rounded-full bg-green-soft px-3 py-1.5 text-xs font-extrabold text-green-deep">
                  {s.stat}
                </span>
                <div className={`flex items-center gap-3 border-t pt-4.5 ${s.dark ? "border-cream/15" : "border-line"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={s.img} alt={s.name} className="size-[46px] rounded-full object-cover" />
                  <div>
                    <div className="text-[14.5px] font-extrabold tracking-tight">{s.name}</div>
                    <div className={`text-[12.5px] font-semibold ${s.dark ? "text-[#9C968A]" : "text-muted"}`}>{s.role}</div>
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
