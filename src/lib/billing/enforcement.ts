import { getPool, type Executor } from "@/lib/db/pool";

/**
 * Plan enforcement gate. Reads the denormalized profiles.plan on the hot path —
 * it NEVER joins subscriptions on a booking attempt. The source of truth lives
 * in subscriptions; the billing processor keeps profiles.plan in lockstep, so
 * this layer can trust the cache.
 *
 * Free plan limits (V1): 1 service, 5 CONFIRMED bookings per calendar month in
 * the creator's timezone (IST). Pro is unlimited.
 */

export const FREE_BOOKINGS_PER_MONTH = 5;
export const FREE_MAX_SERVICES = 1;

/**
 * The current calendar month in IST, expressed as a half-open [start, end)
 * range of UTC instants. `(timestamp at time zone 'Asia/Kolkata')` reads the
 * IST wall-clock month boundary back as a timestamptz, so a booking's
 * created_at (timestamptz) is bucketed by the creator's civil month, not UTC's.
 */
const IST_MONTH_START = `((date_trunc('month', now() at time zone 'Asia/Kolkata')) at time zone 'Asia/Kolkata')`;
const IST_MONTH_END = `((date_trunc('month', now() at time zone 'Asia/Kolkata') + interval '1 month') at time zone 'Asia/Kolkata')`;

/**
 * Client-facing booking block (Decision B). Thrown when a free creator is at
 * their monthly limit. It carries the creator's WhatsApp number so the public
 * UI can offer a neutral, dignified fallback. CRITICAL: this error and anything
 * derived from it must NEVER expose "limit", "free", "plan" or "upgrade" to the
 * client — to a visitor it must look like a deliberate availability choice.
 */
export class BookingsUnavailableError extends Error {
  readonly whatsappNumber: string | null;
  constructor(whatsappNumber: string | null) {
    super("Bookings are not open for this creator right now");
    this.name = "BookingsUnavailableError";
    this.whatsappNumber = whatsappNumber;
  }
}

/** The creator's entitlement from the hot-path cache. Defaults to 'free'. */
export async function getPlan(creatorId: string, db: Executor = getPool()): Promise<"free" | "pro"> {
  const { rows } = await db.query<{ plan: string }>(`select plan from public.profiles where id = $1`, [creatorId]);
  return rows[0]?.plan === "pro" ? "pro" : "free";
}

/** Count CONFIRMED bookings this IST calendar month for a creator (Decision C). */
export async function confirmedBookingsThisMonth(creatorId: string, db: Executor = getPool()): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n
       from public.bookings
      where creator_id = $1
        and status = 'confirmed'
        and created_at >= ${IST_MONTH_START}
        and created_at <  ${IST_MONTH_END}`,
    [creatorId],
  );
  return rows[0]?.n ?? 0;
}

/** Pro: always. Free: only while under the monthly confirmed-booking limit. */
export async function canAcceptBooking(creatorId: string, db: Executor = getPool()): Promise<boolean> {
  if ((await getPlan(creatorId, db)) === "pro") return true;
  return (await confirmedBookingsThisMonth(creatorId, db)) < FREE_BOOKINGS_PER_MONTH;
}

/** Count of a creator's active services. */
export async function activeServiceCount(creatorId: string, db: Executor = getPool()): Promise<number> {
  const { rows } = await db.query<{ n: number }>(
    `select count(*)::int as n from public.services where profile_id = $1 and is_active = true`,
    [creatorId],
  );
  return rows[0]?.n ?? 0;
}

/** Pro: always. Free: only while under the service cap. */
export async function canCreateService(creatorId: string, db: Executor = getPool()): Promise<boolean> {
  if ((await getPlan(creatorId, db)) === "pro") return true;
  return (await activeServiceCount(creatorId, db)) < FREE_MAX_SERVICES;
}

/** The creator's WhatsApp number, for the Decision B client fallback. */
export async function getCreatorWhatsapp(creatorId: string, db: Executor = getPool()): Promise<string | null> {
  const { rows } = await db.query<{ whatsapp_number: string | null }>(
    `select whatsapp_number from public.profiles where id = $1`,
    [creatorId],
  );
  return rows[0]?.whatsapp_number ?? null;
}

/**
 * Enqueue a one-time, idempotent "you've hit your free limit" nudge for every
 * free creator who has reached the monthly confirmed-booking limit. The nudge
 * is tied to the creator's latest confirmed booking this month, so the existing
 * notification_queue identity index (booking_id, type) makes re-runs no-ops —
 * exactly one nudge per creator per month. Driven by the billing cron, so it
 * fires within a tick of the 5th confirmation, BEFORE a client attempts #6.
 *
 * This is billing's own append to notification_queue (recipient = creator); it
 * touches no payment/booking state. Delivery rides the existing notification
 * worker, which is type-agnostic.
 */
export async function enqueueCreatorLimitNudges(db: Executor = getPool()): Promise<{ enqueued: number }> {
  const { rows } = await db.query<{ booking_id: string }>(
    `with monthly as (
       select b.creator_id,
              count(*) as confirmed,
              (array_agg(b.id order by b.created_at desc))[1] as latest_booking,
              (array_agg(b.correlation_id order by b.created_at desc))[1] as latest_corr
         from public.bookings b
         join public.profiles p on p.id = b.creator_id
        where b.status = 'confirmed'
          and p.plan = 'free'
          and b.created_at >= ${IST_MONTH_START}
          and b.created_at <  ${IST_MONTH_END}
        group by b.creator_id
     )
     insert into public.notification_queue (correlation_id, booking_id, type, channel, payload)
     select m.latest_corr, m.latest_booking, 'creator_plan_limit', 'whatsapp',
            jsonb_build_object(
              'recipient', 'creator',
              'kind', 'plan_limit',
              'to', p.whatsapp_number,
              'text', 'You''ve hit your free plan''s monthly booking limit. '
                      || 'Upgrade to Pro to keep accepting bookings this month.'
            )
       from monthly m
       join public.profiles p on p.id = m.creator_id
      where m.confirmed >= ${FREE_BOOKINGS_PER_MONTH}
     on conflict (booking_id, type) do nothing
     returning booking_id`,
  );
  return { enqueued: rows.length };
}
