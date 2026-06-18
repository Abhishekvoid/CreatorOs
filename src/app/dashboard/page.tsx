import type { Metadata } from "next";
import EmptyState from "@/components/dashboard/EmptyState";
import { HeroCard } from "@/components/dashboard/Overview";
import { ActivityFeed, QuickActions, UpcomingBookings } from "@/components/dashboard/Panels";
import ProfileStatusStrip from "@/components/dashboard/ProfileStatusStrip";
import Shell from "@/components/dashboard/Shell";
import { getCreatorDashboard, type CreatorDashboard } from "@/lib/dashboard";
import { getDashboardIdentity } from "@/lib/dashboard-identity";

export const metadata: Metadata = {
  title: "Dashboard | CreatorOS",
  description: "Your creator business at a glance — bookings, payments and activity.",
};

const EMPTY_DASHBOARD: CreatorDashboard = {
  revenue: { lifetimePaise: 0, thisMonthPaise: 0 },
  confirmedBookings: 0,
  upcoming: [],
  activity: [],
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const isNew = state === "new";

  // Identity (profiles) comes from the Supabase client; bookings/revenue/activity
  // come from the service-role pg pool inside getCreatorDashboard — the booking
  // tables are RLS-locked away from the authenticated client. Both are scoped to
  // this signed-in creator. In local dev without Supabase we render neutral empty
  // states rather than mock data.
  const identity = await getDashboardIdentity();
  let data: CreatorDashboard = EMPTY_DASHBOARD;

  if (identity) {
    try {
      data = await getCreatorDashboard(identity.userId);
    } catch (err) {
      // The page must still render the profile + status even if the booking
      // store is unreachable (e.g. SUPABASE_DB_URL unset). Fall back to empty.
      console.error("[dashboard] failed to load creator dashboard data", err);
    }
  }

  const creator = identity?.creator ?? null;
  const isPublished = creator?.isPublished ?? false;

  return (
    <Shell creator={creator}>
      <div className="flex flex-col gap-5">
        {creator && <ProfileStatusStrip handle={creator.handle} isPublished={creator.isPublished} />}
        {isNew && <EmptyState />}
        <HeroCard revenue={data.revenue} confirmedBookings={data.confirmedBookings} />
        <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
          <UpcomingBookings bookings={data.upcoming} isPublished={isPublished} />
          <QuickActions handle={creator?.handle ?? null} isPublished={isPublished} />
        </div>
        <ActivityFeed items={data.activity} />
      </div>
    </Shell>
  );
}
