import type { PoolClient } from "pg";
import { getPool, type Executor } from "@/lib/db/pool";

/**
 * Client CRM (FR-40 / FR-41).
 *
 * Two halves of one concern:
 *   • upsertClientForBooking — the WRITE side, called ONLY by the Processor
 *     inside its confirm transaction (downstream of truth, like the
 *     notification queue). It never touches bookings/locks/orders.
 *   • getCreatorClients / getCreatorClientDetail — the READ side, owner-scoped,
 *     read through the service-role pg pool exactly like src/lib/bookings.ts.
 *     Every query is pinned to a single creator_id; a cross-creator id returns
 *     null (→ 404), never a leak.
 */

function num(v: unknown): number {
  return Number(v ?? 0);
}

function iso(v: unknown): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : String(v);
}

/* ----------------------------- write side ------------------------------ */

/**
 * Create or update the client record for a freshly-confirmed booking.
 *
 * Call this ONLY when a booking has just transitioned payment_pending ->
 * confirmed for the first time (i.e. confirmBooking returned
 * bookingConfirmed === true). That gate is the idempotency guarantee: the
 * processor re-applying a duplicate/out-of-order event re-runs confirmBooking,
 * which no-ops, so this never fires twice for the same booking and
 * booking_count / lifetime_spend can't double-count.
 *
 * Identity is (creator_id, whatsapp). first/last_booking_at track the booking's
 * created_at via least()/greatest(), so the result is independent of the order
 * confirmations arrive in. Bookings with no phone number are skipped (the
 * column is required at the booking API, but the guard keeps the WhatsApp
 * identity key non-null).
 */
export async function upsertClientForBooking(
  client: PoolClient,
  bookingId: string,
): Promise<void> {
  await client.query(
    `insert into public.clients
       (creator_id, name, whatsapp, email, booking_count, lifetime_spend_paise,
        first_booking_at, last_booking_at)
     select b.creator_id, b.customer_name, b.customer_phone, b.customer_email,
            1, b.amount_paise, b.created_at, b.created_at
       from public.bookings b
      where b.id = $1 and b.customer_phone is not null
     on conflict (creator_id, whatsapp) do update
       set booking_count        = clients.booking_count + 1,
           lifetime_spend_paise = clients.lifetime_spend_paise + excluded.lifetime_spend_paise,
           name                 = coalesce(nullif(excluded.name, ''), clients.name),
           email                = coalesce(nullif(excluded.email, ''), clients.email),
           first_booking_at     = least(clients.first_booking_at, excluded.first_booking_at),
           last_booking_at      = greatest(clients.last_booking_at, excluded.last_booking_at),
           updated_at           = now()`,
    [bookingId],
  );
}

/* ------------------------------ read side ------------------------------ */

export type ClientListItem = {
  id: string;
  name: string | null;
  whatsapp: string;
  email: string | null;
  bookingCount: number;
  lifetimeSpendPaise: number;
  lastBookingAt: string | null; // ISO
};

export type ClientBooking = {
  id: string;
  serviceTitle: string | null;
  slotStart: string; // ISO
  slotEnd: string; // ISO
  status: string; // confirmed | cancelled
  amountPaise: number;
};

export type ClientDetail = {
  id: string;
  name: string | null;
  whatsapp: string;
  email: string | null;
  bookingCount: number;
  lifetimeSpendPaise: number;
  firstBookingAt: string | null; // ISO
  lastBookingAt: string | null; // ISO
  /** service_id of the most recent confirmed booking; null if none or deleted */
  lastServiceId: string | null;
  bookings: ClientBooking[];
};

/**
 * Every client a creator owns, most-recent booking first. One owner-scoped
 * scan — the creator_id predicate is the isolation boundary.
 */
export async function getCreatorClients(
  creatorId: string,
  db: Executor = getPool(),
): Promise<ClientListItem[]> {
  const { rows } = await db.query(
    `select id, name, whatsapp, email, booking_count, lifetime_spend_paise, last_booking_at
       from public.clients
      where creator_id = $1
      order by last_booking_at desc nulls last`,
    [creatorId],
  );
  return rows.map((r) => ({
    id: String(r.id),
    name: r.name ?? null,
    whatsapp: String(r.whatsapp),
    email: r.email ?? null,
    bookingCount: num(r.booking_count),
    lifetimeSpendPaise: num(r.lifetime_spend_paise),
    lastBookingAt: iso(r.last_booking_at),
  }));
}

/**
 * One client and their booking history, or null if the id doesn't exist or
 * isn't owned by this creator. The creator_id predicate is the access control:
 * creator A asking for creator B's client id gets null (→ 404), never a leak.
 *
 * Booking history is matched by (creator_id, customer_phone = whatsapp) — the
 * same identity the upsert keys on — so no client_id FK on bookings is needed.
 * Only real bookings (confirmed/cancelled) are shown, mirroring the bookings
 * list; abandoned payment_pending/expired attempts never surface.
 */
export async function getCreatorClientDetail(
  creatorId: string,
  clientId: string,
  db: Executor = getPool(),
): Promise<ClientDetail | null> {
  const { rows } = await db.query(
    `select id, name, whatsapp, email, booking_count, lifetime_spend_paise,
            first_booking_at, last_booking_at
       from public.clients
      where id = $1 and creator_id = $2`,
    [clientId, creatorId],
  );
  const c = rows[0];
  if (!c) return null;

  const { rows: bookingRows } = await db.query(
    `select b.id, b.slot_start, b.slot_end, b.status, b.amount_paise,
            s.title as service_title
       from public.bookings b
       left join public.services s on s.id = b.service_id
      where b.creator_id = $1
        and b.customer_phone = $2
        and b.status in ('confirmed', 'cancelled')
      order by b.slot_start desc`,
    [creatorId, c.whatsapp],
  );

  // The service this client last booked, for one-click rebooking. Confirmed
  // only, creator-scoped, deterministic (latest booked first). May be null —
  // no confirmed bookings, or the service was deleted (service_id set null) —
  // in which case the rebook link simply omits ?service= and falls back.
  const { rows: lastServiceRows } = await db.query<{ service_id: string | null }>(
    `select b.service_id
       from public.bookings b
      where b.creator_id = $1
        and b.customer_phone = $2
        and b.status = 'confirmed'
      order by b.created_at desc, b.id desc
      limit 1`,
    [creatorId, c.whatsapp],
  );

  return {
    id: String(c.id),
    name: c.name ?? null,
    whatsapp: String(c.whatsapp),
    email: c.email ?? null,
    bookingCount: num(c.booking_count),
    lifetimeSpendPaise: num(c.lifetime_spend_paise),
    firstBookingAt: iso(c.first_booking_at),
    lastBookingAt: iso(c.last_booking_at),
    lastServiceId: lastServiceRows[0]?.service_id ?? null,
    bookings: bookingRows.map((r) => ({
      id: String(r.id),
      serviceTitle: r.service_title ?? null,
      slotStart: iso(r.slot_start) as string,
      slotEnd: iso(r.slot_end) as string,
      status: String(r.status),
      amountPaise: num(r.amount_paise),
    })),
  };
}
