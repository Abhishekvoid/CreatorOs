import Link from "next/link";

export default function EmptyState() {
  return (
    <section className="dot-texture relative overflow-hidden rounded-[32px] border border-line bg-grad-soft px-7 py-12 text-center max-sm:px-5">
      <div className="relative mx-auto max-w-[460px]">
        {/* small illustrative scene: calendar + payment, the two things setup unlocks */}
        <svg viewBox="0 0 200 96" className="mx-auto h-24 w-auto" aria-hidden="true">
          <rect x="34" y="14" width="76" height="68" rx="12" fill="#fff" stroke="var(--color-line-2)" strokeWidth="1.5" />
          <rect x="34" y="14" width="76" height="20" rx="12" fill="var(--color-ink)" />
          <rect x="34" y="26" width="76" height="8" fill="var(--color-ink)" />
          <circle cx="52" cy="24" r="2.5" fill="var(--color-terra)" />
          <circle cx="62" cy="24" r="2.5" fill="var(--color-amber)" />
          <path d="M52 56l8 8 16-16" fill="none" stroke="var(--color-green)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="104" y="38" width="64" height="44" rx="10" fill="#fff" stroke="var(--color-line-2)" strokeWidth="1.5" transform="rotate(6 104 38)" />
          <text x="140" y="68" transform="rotate(6 104 38)" textAnchor="middle" fontSize="20" fontWeight="900" fill="var(--color-terra)">
            ₹
          </text>
          <path d="M20 40c4-8 10-12 18-13" fill="none" stroke="var(--color-faint)" strokeWidth="1.5" strokeDasharray="3 4" strokeLinecap="round" />
          <circle cx="172" cy="22" r="2" fill="var(--color-amber)" />
          <circle cx="16" cy="62" r="2" fill="var(--color-terra)" />
        </svg>

        <h1 className="mt-5 text-[26px] font-black tracking-[-0.02em]">
          Welcome to Creator<span className="font-medium text-muted">OS</span>
        </h1>
        <p className="mt-2 text-[15px] font-medium text-muted">
          Let&rsquo;s get your <span className="font-serif italic text-terra-deep">first booking.</span> Three quick
          steps and your storefront is open for business.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
          <Link href="/onboarding/service" className="btn btn-grad !px-5.5 !py-2.5 !text-[13.5px]">
            Create a service <span className="arr">→</span>
          </Link>
          <Link href="/onboarding/availability" className="btn btn-ghost !bg-paper !px-5 !py-2.5 !text-[13.5px]">
            Set availability
          </Link>
          <Link href="/onboarding/payments" className="btn btn-ghost !bg-paper !px-5 !py-2.5 !text-[13.5px]">
            Connect payments
          </Link>
        </div>
        <p className="mt-4 text-[12px] font-semibold text-muted">
          Most creators are live in under 10 minutes — and the first booking usually follows within a week.
        </p>
      </div>
    </section>
  );
}
