import type { Metadata } from "next";
import BillingPanel from "@/components/dashboard/BillingPanel";
import Shell from "@/components/dashboard/Shell";
import { getBillingOverview, type BillingOverview } from "@/lib/billing/overview";
import { getDashboardIdentity } from "@/lib/dashboard-identity";

export const metadata: Metadata = {
  title: "Billing | CreatorOS",
  description: "Your plan, usage and upgrade options.",
};

const EMPTY_OVERVIEW: BillingOverview = {
  plan: "free",
  status: null,
  currentPeriodEnd: null,
  usage: {
    confirmedThisMonth: 0,
    bookingLimit: 5,
    bookingsRemaining: 5,
    services: 0,
    serviceLimit: 1,
    atBookingLimit: false,
  },
};

export default async function BillingPage() {
  const identity = await getDashboardIdentity();
  let overview = EMPTY_OVERVIEW;

  if (identity) {
    try {
      overview = await getBillingOverview(identity.userId);
    } catch (err) {
      // Render the page with neutral defaults if the billing store is briefly
      // unreachable, rather than dead-ending the creator. Never silent: logged.
      console.error("[billing] failed to load overview", err);
    }
  }

  return (
    <Shell creator={identity?.creator ?? null}>
      <BillingPanel overview={overview} />
    </Shell>
  );
}
