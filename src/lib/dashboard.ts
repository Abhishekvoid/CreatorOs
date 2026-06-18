import { getPool, type Executor } from "@/lib/db/pool";

/**
 * Creator Dashboard query layer — READ-ONLY, owner-scoped.
 *
 * The booking/payment tables are service-role only (schema.sql Part 4 RLS:
 * zero policies, revoked from `authenticated`), so the dashboard's Supabase
 * client cannot read them at all. This layer reaches them through the same
 * service-role `pg` pool the payments workers use, and EVERY query is pinned
 * to a single `creator_id`. There are no global counts and no cross-creator
 * joins: a creator only ever sees their own bookings, revenue and activity.
 *
 * Money is stored in paise; callers format to rupees. Timestamps come back as
 * ISO strings (pg returns Date — we normalise to ISO for the server→client
 * boundary).
 */

export type RevenueSummary = {
  /** sum(amount_paise) over all confirmed bookings, all time */
  lifetimePaise: number;
  /**
   * sum(amount_paise) over bookings confirmed in the current calendar month.
   * "This month" is keyed on confirmation time: a confirmed booking's
   * updated_at is the moment the Processor flipped it to `confirmed`.
   */
  thisMonthPaise: number;
};

export type UpcomingBooking = {
  id: string;
  /** service title, or null if the service was deleted (FK on delete set null) */
  serviceTitle: string | null;
  /** customer name if captured at booking time, else null → graceful fallback */
  customerName: string | null;
  slotStart: string; // ISO
  slotEnd: string; // ISO
  status: "confirmed";
};

export type ActivityItem = {
  /** a booking became confirmed (money landed) vs. a booking was created */
  kind: "booking_confirmed" | "booking_received";
  ts: string; // ISO
  customerName: string | null;
  serviceTitle: string | null;
  /** present for booking_confirmed (the captured amount), else null */
  amountPaise: number | null;
};

export type CreatorDashboard = {
  revenue: RevenueSummary;
  /** lifetime count of confirmed bookings — the one real headline stat */
  confirmedBookings: number;
  upcoming: UpcomingBooking[];
  activity: ActivityItem[];
};

const UPCOMING_LIMIT = 6;
const ACTIVITY_LIMIT = 8;

/** bigint/numeric come back as strings; normalise to a JS number. */
function num(v: unknown): number {
  return Number(v ?? 0);
}

/** pg returns timestamptz as a Date; normalise to ISO for the RSC boundary. */
function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

/**
 * Everything the creator dashboard needs, scoped to one creator, in three
 * round-trips (summary, upcoming, activity). All amounts in paise; all
 * timestamps ISO strings.
 */
export async function getCreatorDashboard(
  creatorId: string,
  db: Executor = getPool(),
): Promise<CreatorDashboard> {
  // 1) revenue + confirmed-booking count — single aggregate scan.
  //    Lifetime sums every confirmed booking; this-month restricts to ones
  //    confirmed since the start of the current month (updated_at).
  const summary = await db.query(
    `select
       coalesce(sum(amount_paise) filter (where status = 'confirmed'), 0) as lifetime_paise,
       coalesce(sum(amount_paise) filter (
         where status = 'confirmed' and updated_at >= date_trunc('month', now())
       ), 0) as this_month_paise,
       count(*) filter (where status = 'confirmed') as confirmed_count
     from public.bookings
     where creator_id = $1`,
    [creatorId],
  );
  const s = summary.rows[0] ?? {};

  // 2) upcoming = future confirmed bookings only, soonest first.
  const upcoming = await db.query(
    `select b.id, b.slot_start, b.slot_end, b.status, b.customer_name,
            s.title as service_title
       from public.bookings b
       left join public.services s on s.id = b.service_id
      where b.creator_id = $1
        and b.status = 'confirmed'
        and b.slot_start >= now()
      order by b.slot_start asc
      limit ${UPCOMING_LIMIT}`,
    [creatorId],
  );

  // 3) activity — sourced only from real booking timestamps. A booking
  //    contributes a "received" event (created_at) and, once confirmed, a
  //    "confirmed" event (updated_at). Newest first.
  const activity = await db.query(
    `(
       select 'booking_confirmed' as kind, b.updated_at as ts,
              b.customer_name, s.title as service_title, b.amount_paise
         from public.bookings b
         left join public.services s on s.id = b.service_id
        where b.creator_id = $1 and b.status = 'confirmed'
     )
     union all
     (
       select 'booking_received' as kind, b.created_at as ts,
              b.customer_name, s.title as service_title, null::int as amount_paise
         from public.bookings b
         left join public.services s on s.id = b.service_id
        where b.creator_id = $1
     )
     order by ts desc
     limit ${ACTIVITY_LIMIT}`,
    [creatorId],
  );

  return {
    revenue: {
      lifetimePaise: num(s.lifetime_paise),
      thisMonthPaise: num(s.this_month_paise),
    },
    confirmedBookings: num(s.confirmed_count),
    upcoming: upcoming.rows.map((r) => ({
      id: String(r.id),
      serviceTitle: r.service_title ?? null,
      customerName: r.customer_name ?? null,
      slotStart: iso(r.slot_start),
      slotEnd: iso(r.slot_end),
      status: "confirmed" as const,
    })),
    activity: activity.rows.map((r) => ({
      kind: r.kind as ActivityItem["kind"],
      ts: iso(r.ts),
      customerName: r.customer_name ?? null,
      serviceTitle: r.service_title ?? null,
      amountPaise: r.amount_paise === null || r.amount_paise === undefined ? null : num(r.amount_paise),
    })),
  };
}
