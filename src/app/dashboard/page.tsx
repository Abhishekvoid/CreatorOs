import type { Metadata } from "next";
import EmptyState from "@/components/dashboard/EmptyState";
import { HeroCard, OnboardingCard, StatsGrid } from "@/components/dashboard/Overview";
import { ActivityFeed, PaymentsTable, ProfilePerformance, QuickActions, UpcomingBookings } from "@/components/dashboard/Panels";
import ProfilePreview from "@/components/dashboard/ProfilePreview";
import RevenueChart from "@/components/dashboard/RevenueChart";
import Shell from "@/components/dashboard/Shell";

export const metadata: Metadata = {
  title: "Dashboard | CreatorOS",
  description: "Your creator business at a glance — bookings, payments, clients and growth.",
};

const NEW_CREATOR_STEPS = [
  { label: "Set your handle", done: true },
  { label: "Upload profile photo", done: false },
  { label: "Create first service", done: false },
  { label: "Connect Google Calendar", done: false },
  { label: "Connect payments", done: false },
  { label: "Publish profile", done: false },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  const { state } = await searchParams;
  const isNew = state === "new";

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        {isNew ? (
          <>
            <EmptyState />
            <OnboardingCard steps={NEW_CREATOR_STEPS} />
            <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
              <QuickActions />
              <ProfilePreview completion={20} />
            </div>
          </>
        ) : (
          <>
            <div className="grid items-stretch gap-5 xl:grid-cols-[1fr_320px]">
              <HeroCard />
              <ProfilePreview />
            </div>
            <OnboardingCard />
            <StatsGrid />
            <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
              <RevenueChart />
              <ProfilePerformance />
            </div>
            <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
              <UpcomingBookings />
              <QuickActions />
            </div>
            <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
              <PaymentsTable />
              <ActivityFeed />
            </div>
          </>
        )}
      </div>
    </Shell>
  );
}
