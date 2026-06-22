import { getPool, type Executor } from "@/lib/db/pool";
import {
  activeServiceCount,
  confirmedBookingsThisMonth,
  FREE_BOOKINGS_PER_MONTH,
  FREE_MAX_SERVICES,
} from "./enforcement";

/**
 * The read model behind /dashboard/billing and the over-limit banner. Plan +
 * status + usage, nothing more — V1 deliberately has no invoices or history.
 * Reads via the service-role pool (subscriptions is owner-private; this runs
 * server-side scoped to the signed-in creator).
 */

export type BillingOverview = {
  plan: "free" | "pro";
  /** subscription lifecycle status, or null when the creator never upgraded */
  status: string | null;
  currentPeriodEnd: string | null;
  usage: {
    confirmedThisMonth: number;
    bookingLimit: number; // -1 = unlimited (Pro)
    bookingsRemaining: number; // -1 = unlimited
    services: number;
    serviceLimit: number; // -1 = unlimited (Pro)
    atBookingLimit: boolean;
  };
};

export async function getBillingOverview(creatorId: string, db: Executor = getPool()): Promise<BillingOverview> {
  const [{ rows: profileRows }, { rows: subRows }, confirmedThisMonth, services] = await Promise.all([
    db.query<{ plan: string }>(`select plan from public.profiles where id = $1`, [creatorId]),
    db.query<{ status: string; current_period_end: string | null }>(
      `select status, current_period_end from public.subscriptions where creator_id = $1`,
      [creatorId],
    ),
    confirmedBookingsThisMonth(creatorId, db),
    activeServiceCount(creatorId, db),
  ]);

  const plan = profileRows[0]?.plan === "pro" ? "pro" : "free";
  const isPro = plan === "pro";
  const bookingLimit = isPro ? -1 : FREE_BOOKINGS_PER_MONTH;
  const serviceLimit = isPro ? -1 : FREE_MAX_SERVICES;

  return {
    plan,
    status: subRows[0]?.status ?? null,
    currentPeriodEnd: subRows[0]?.current_period_end ?? null,
    usage: {
      confirmedThisMonth,
      bookingLimit,
      bookingsRemaining: isPro ? -1 : Math.max(0, FREE_BOOKINGS_PER_MONTH - confirmedThisMonth),
      services,
      serviceLimit,
      atBookingLimit: !isPro && confirmedThisMonth >= FREE_BOOKINGS_PER_MONTH,
    },
  };
}
