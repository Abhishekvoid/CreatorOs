import Reveal from "../Reveal";

export default function ProfileCta() {
  return (
    <section className="pb-[clamp(72px,10vw,120px)]">
      <div className="mx-auto max-w-[1160px] px-6">
        <Reveal>
          <div className="glow-top relative overflow-hidden rounded-[clamp(26px,4vw,44px)] bg-linear-160 from-[#241F16] to-[#191712] to-60% px-[clamp(24px,6vw,90px)] py-[clamp(50px,7vw,90px)] text-center text-cream shadow-pop">
            <h2 className="relative z-1 mb-4.5 text-[clamp(30px,4.6vw,50px)] font-black leading-[1.08] tracking-tight">
              Ready to take the next step?
              <br />
              <span className="font-serif font-normal italic">Book your session today.</span>
            </h2>
            <p className="relative z-1 mx-auto mb-9 max-w-[480px] text-[clamp(15px,1.7vw,17.5px)] font-medium text-[#B5B0A4]">
              45 minutes, a written plan, and a recording to keep. If the first session isn&rsquo;t worth it,
              you don&rsquo;t pay — simple.
            </p>
            <div className="relative z-1 flex flex-wrap items-center justify-center gap-3.5">
              <a href="/meera/book" className="btn btn-grad btn-lg">
                Book now — ₹1,499 <span className="arr">→</span>
              </a>
            </div>
            <div className="relative z-1 mt-5 text-[13px] font-semibold text-[#8E897D]">
              Next slot today, 5:00 pm · replies within 2 hours · 100% first-session guarantee
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
