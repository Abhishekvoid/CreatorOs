import type { RevenueSummary } from "@/lib/dashboard";
import Counter from "../Counter";
import { formatRupees } from "./format";

/* ---------------- headline numbers ---------------- */
/**
 * The dashboard's one numbers card. Every value is real, scoped to the signed-in
 * creator: revenue this month and lifetime (confirmed bookings only) and the
 * lifetime confirmed-booking count. No trends, no charts — just the numbers.
 * Counter animates to the target and formats with Indian digit grouping.
 */
export function HeroCard({
  revenue,
  confirmedBookings,
}: {
  revenue: RevenueSummary;
  confirmedBookings: number;
}) {
  const thisMonth = Math.round(revenue.thisMonthPaise / 100);
  const lifetime = Math.round(revenue.lifetimePaise / 100);

  return (
    <section className="glow-tr relative flex flex-col overflow-hidden rounded-[28px] border border-[#2E2A21] bg-linear-165 from-[#211E17] to-[#191712] p-7 text-cream shadow-card max-sm:p-6">
      <div className="relative">
        <h1 className="text-[24px] font-bold leading-tight tracking-[-0.02em]">
          Your <span className="font-serif italic font-normal">creator business.</span>
        </h1>
        <p className="mt-1.5 max-w-[420px] text-[13.5px] font-medium text-[#B5B0A4]">
          Everything happening across bookings and payments — in one calm place.
        </p>
      </div>

      <div className="relative mt-7 flex flex-wrap gap-x-9 gap-y-4 border-t border-cream/10 pt-5">
        <div>
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#8E897D]">
            Revenue · this month
          </div>
          {/* money landed is green — the one place color celebrates */}
          <div className="mt-1 text-[32px] font-black leading-none tracking-tight text-[#7BD3AC]">
            {thisMonth > 0 ? <>₹<Counter to={thisMonth} /></> : <span aria-label={formatRupees(0)}>₹0</span>}
          </div>
        </div>
        <div className="border-l border-cream/10 pl-9 max-sm:border-0 max-sm:pl-0">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#8E897D]">
            Revenue · lifetime
          </div>
          <div className="mt-1 text-[32px] font-black leading-none tracking-tight">
            {lifetime > 0 ? <>₹<Counter to={lifetime} /></> : "₹0"}
          </div>
        </div>
        <div className="border-l border-cream/10 pl-9 max-sm:border-0 max-sm:pl-0">
          <div className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#8E897D]">
            Confirmed bookings
          </div>
          <div className="mt-1 text-[32px] font-black leading-none tracking-tight">
            {confirmedBookings > 0 ? <Counter to={confirmedBookings} /> : "0"}
          </div>
        </div>
      </div>
    </section>
  );
}
