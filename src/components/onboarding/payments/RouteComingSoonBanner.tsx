/**
 * A calm "coming soon" banner naming exactly what's being built on the payouts
 * side — no fake balances, no fake earnings, no dates promised. Sets honest
 * expectations alongside the current-state card.
 */
const ITEMS = [
  "Razorpay Route onboarding",
  "Direct creator payouts",
  "Automated settlement",
];

export default function RouteComingSoonBanner() {
  return (
    <div className="rounded-[18px] border border-line bg-cream/60 p-5">
      <div className="text-[12px] font-bold uppercase tracking-[0.07em] text-terra-deep">
        Coming soon
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {ITEMS.map((item) => (
          <li key={item} className="flex items-center gap-2.5 text-[14px] font-medium text-ink-2">
            <span className="size-1.5 shrink-0 rounded-full bg-line-2" aria-hidden="true" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
