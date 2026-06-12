const COMPANIES = ["Google", "Microsoft", "Flipkart", "Razorpay", "Swiggy", "Zerodha"];

const CREDENTIALS = [
  { icon: "🎖", text: "ICF-ACC Certified Coach" },
  { icon: "🎓", text: "XLRI Jamshedpur" },
  { icon: "🏆", text: "Top 1% Mentor, 2025" },
];

const PRESS = ["YourStory", "Mint", "The Ken"];

export default function TrustStrip() {
  return (
    <section className="border-y border-line bg-paper py-8" aria-label="Credentials and trust signals">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-6 px-6">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 max-md:justify-center">
          <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">
            Clients placed at
          </span>
          <div className="flex flex-wrap items-center gap-x-7 gap-y-2 max-md:justify-center">
            {COMPANIES.map((c) => (
              <span
                key={c}
                className="text-[17px] font-black tracking-tight text-faint transition-colors duration-300 hover:text-ink-2"
              >
                {c}
              </span>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 max-md:justify-center">
          <div className="flex flex-wrap items-center gap-2.5 max-md:justify-center">
            {CREDENTIALS.map((c) => (
              <span
                key={c.text}
                className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-3.5 py-1.5 text-[13px] font-bold text-ink-2"
              >
                <span aria-hidden="true">{c.icon}</span>
                {c.text}
              </span>
            ))}
            <span className="inline-flex items-center gap-2 rounded-full border border-line bg-cream px-3.5 py-1.5 text-[13px] font-bold text-ink-2">
              <span className="text-amber" aria-hidden="true">★</span>
              4.9 · 212 verified reviews
            </span>
          </div>
          <div className="flex items-center gap-3 text-[13.5px] font-semibold text-muted">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-faint">Featured in</span>
            {PRESS.map((p, i) => (
              <span key={p} className="font-serif text-[16.5px] italic text-ink-2">
                {p}
                {i < PRESS.length - 1 && <span className="ml-3 not-italic text-line-2">·</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
