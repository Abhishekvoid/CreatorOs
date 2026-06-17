import type { Metadata } from "next";
import { redirect } from "next/navigation";
import EmptyState from "@/components/dashboard/EmptyState";
import { HeroCard, OnboardingCard, StatsGrid } from "@/components/dashboard/Overview";
import { ActivityFeed, PaymentsTable, ProfilePerformance, QuickActions, UpcomingBookings } from "@/components/dashboard/Panels";
import ProfilePreview from "@/components/dashboard/ProfilePreview";
import ProfileStatusStrip from "@/components/dashboard/ProfileStatusStrip";
import RevenueChart from "@/components/dashboard/RevenueChart";
import Shell from "@/components/dashboard/Shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

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

  // The status strip is the one real, data-backed element on the dashboard;
  // the surrounding cards are still design mockups. When Supabase is configured
  // we require a signed-in creator with a claimed handle. In local dev without
  // Supabase we skip the gate and the strip, leaving the static mockup intact.
  let status: { handle: string; isPublished: boolean } | null = null;
  if (isSupabaseConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
    const { data: profile } = await supabase
      .from("profiles")
      .select("handle, is_published")
      .eq("id", user.id)
      .maybeSingle<{ handle: string | null; is_published: boolean | null }>();
    if (!profile?.handle) redirect("/onboarding/handle");
    status = { handle: profile.handle, isPublished: Boolean(profile.is_published) };
  }

  return (
    <Shell>
      <div className="flex flex-col gap-5">
        {status && <ProfileStatusStrip handle={status.handle} isPublished={status.isPublished} />}
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
