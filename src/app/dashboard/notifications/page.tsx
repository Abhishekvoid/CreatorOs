import type { Metadata } from "next";
import NotificationsList from "@/components/dashboard/NotificationsList";
import Shell from "@/components/dashboard/Shell";
import { getDashboardIdentity } from "@/lib/dashboard-identity";
import { getCreatorNotifications, type CreatorNotification } from "@/lib/notifications/queue";

export const metadata: Metadata = {
  title: "Notifications | CreatorOS",
  description: "See the delivery status of your recent notifications.",
};

export default async function NotificationsPage() {
  // Same owner-scoped path as bookings: identity from Supabase, notifications
  // from the service-role pool, the query pinned to this creator.
  const identity = await getDashboardIdentity();
  let notifications: CreatorNotification[] = [];

  if (identity) {
    try {
      notifications = await getCreatorNotifications(identity.userId);
    } catch (err) {
      console.error("[notifications] failed to load creator notifications", err);
    }
  }

  return (
    <Shell creator={identity?.creator ?? null}>
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em]">Notifications</h1>
          <p className="mt-1 text-[13.5px] font-medium text-muted">
            Delivery status of your recent notifications — newest first.
          </p>
        </div>
        <NotificationsList notifications={notifications} />
      </div>
    </Shell>
  );
}
