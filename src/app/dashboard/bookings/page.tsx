import type { Metadata } from "next";
import BookingsList from "@/components/dashboard/BookingsList";
import Shell from "@/components/dashboard/Shell";
import { getCreatorBookings, type GroupedBookings } from "@/lib/bookings";
import { getDashboardIdentity } from "@/lib/dashboard-identity";

export const metadata: Metadata = {
  title: "Bookings | CreatorOS",
  description: "View and manage your upcoming, past and cancelled bookings.",
};

const EMPTY: GroupedBookings = { upcoming: [], past: [], cancelled: [] };

export default async function BookingsPage() {
  // Same owner-scoped path as the dashboard: identity from Supabase, bookings
  // from the service-role pool, every query pinned to this creator.
  const identity = await getDashboardIdentity();
  let groups: GroupedBookings = EMPTY;

  if (identity) {
    try {
      groups = await getCreatorBookings(identity.userId);
    } catch (err) {
      // Page still renders (empty) if the booking store is unreachable.
      console.error("[bookings] failed to load creator bookings", err);
    }
  }

  return (
    <Shell creator={identity?.creator ?? null}>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Bookings</h1>
          <p className="mt-1 text-[13.5px] font-medium text-muted">
            Everything you&rsquo;ve booked — upcoming, past and cancelled.
          </p>
        </div>
        <BookingsList groups={groups} />
      </div>
    </Shell>
  );
}
