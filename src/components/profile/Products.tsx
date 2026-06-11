import Reveal from "../Reveal";
import { SectionHead } from "../ui";

const PRODUCTS: {
  icon: string;
  coverBg: string;
  fileType: string;
  title: string;
  desc: string;
  price: string;
  bestseller?: boolean;
}[] = [
  {
    icon: "📘",
    coverBg: "bg-[#FCE9E1]",
    fileType: "PDF + Notion",
    title: "Interview Prep Kit",
    desc: "120 real questions, answer frameworks and the salary-negotiation scripts I give every client.",
    price: "₹499",
    bestseller: true,
  },
  {
    icon: "📄",
    coverBg: "bg-[#FDF3DF]",
    fileType: "DOCX + Figma",
    title: "Resume Template Pack",
    desc: "6 ATS-proof templates with a writing prompt inside every section, so you never stare at a blank page.",
    price: "₹299",
  },
  {
    icon: "🗂️",
    coverBg: "bg-green-soft",
    fileType: "Notion template",
    title: "Productivity Notion System",
    desc: "The exact system I use to run 340+ sessions a year — pipeline, notes and follow-ups in one board.",
    price: "₹699",
  },
  {
    icon: "🗺️",
    coverBg: "bg-cream-2",
    fileType: "PDF",
    title: "Career Roadmap PDF",
    desc: "A 12-month plan from “stuck” to a signed offer, with monthly checkpoints you can actually keep.",
    price: "₹199",
  },
];

export default function Products() {
  return (
    <section id="products" className="border-y border-line bg-paper py-[clamp(64px,9vw,110px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <SectionHead
            eyebrow="Digital products"
            title={
              <>
                Can&rsquo;t make a session?{" "}
                <span className="font-serif italic font-normal">Start here for less.</span>
              </>
            }
            sub="Instant downloads, delivered to your email and WhatsApp the moment you pay."
          />
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.title} delay={i * 70}>
              <div className="group flex h-full flex-col overflow-hidden rounded-[24px] border border-line bg-cream transition-all duration-400 hover:-translate-y-1.5 hover:shadow-card">
                {/* cover */}
                <div className={`dot-texture relative grid aspect-[4/3] place-items-center ${p.coverBg}`}>
                  <span
                    className="text-[54px] transition-transform duration-400 ease-spring group-hover:-rotate-6 group-hover:scale-110"
                    aria-hidden="true"
                  >
                    {p.icon}
                  </span>
                  <span className="absolute left-3.5 top-3.5 rounded-full bg-ink/80 px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-cream backdrop-blur-sm">
                    {p.fileType}
                  </span>
                  {p.bestseller && (
                    <span className="absolute right-3.5 top-3.5 rounded-full bg-grad px-2.5 py-1 text-[10.5px] font-extrabold uppercase tracking-wide text-white shadow-[0_4px_12px_-3px_rgba(226,85,44,.55)]">
                      Bestseller
                    </span>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-5">
                  <h3 className="text-[16.5px] font-extrabold tracking-tight">{p.title}</h3>
                  <p className="mt-1.5 flex-1 text-[13.5px] font-medium leading-relaxed text-muted">{p.desc}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
                    <div>
                      <b className="text-[19px] font-black tracking-tight">{p.price}</b>
                      <span className="ml-1.5 inline-flex items-center gap-1 text-[11px] font-bold text-green">
                        <span className="size-1.5 rounded-full bg-green" /> Instant
                      </span>
                    </div>
                    <a href="#" className="btn btn-primary !px-4.5 !py-2 !text-[13px]">
                      Buy now
                    </a>
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
