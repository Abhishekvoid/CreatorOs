import type { Metadata } from "next";
import { notFound } from "next/navigation";
import BookingDetail from "@/components/dashboard/BookingDetail";
import Shell from "@/components/dashboard/Shell";
import { getCreatorBookingDetail } from "@/lib/bookings";
import { getDashboardIdentity } from "@/lib/dashboard-identity";

export const metadata: Metadata = {
  title: "Booking | CreatorOS",
};

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const identity = await getDashboardIdentity();
  // No signed-in creator (e.g. local dev without Supabase) → nothing to show.
  if (!identity) notFound();

  // getCreatorBookingDetail is scoped by creator_id: another creator's booking
  // id (or a non-existent one) returns null → 404. This is the access control.
  const detail = await getCreatorBookingDetail(identity.userId, id);
  if (!detail) notFound();

  return (
    <Shell creator={identity.creator}>
      <BookingDetail detail={detail} />
    </Shell>
  );
}
