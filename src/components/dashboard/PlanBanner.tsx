import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { BillingOverview } from "@/lib/billing/overview";

/**
 * Decision B (creator side): when a free creator hits their monthly booking
 * limit, surface a clear upgrade path on the dashboard — BEFORE a client hits
 * the wall. Shows nothing for Pro creators or those still under the limit. This
 * is the creator-facing counterpart to the neutral, plan-free client block.
 */
export default function PlanBanner({ overview }: { overview: BillingOverview }) {
  if (overview.plan === "pro" || !overview.usage.atBookingLimit) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber/30 bg-amber/8 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-amber" strokeWidth={2} />
        <div>
          <div className="text-[14px] font-extrabold tracking-tight">
            You&apos;ve used all {overview.usage.bookingLimit} free bookings this month
          </div>
          <p className="mt-0.5 text-[13px] font-medium text-ink-2">
            New booking requests are paused until next month. Upgrade to Pro to keep taking bookings now.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/billing"
        className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-center text-[13px] font-bold text-cream transition-transform duration-200 hover:scale-[1.02]"
      >
        Upgrade to Pro
      </Link>
    </div>
  );
}
