import { getPool, type Executor } from "@/lib/db/pool";

/**
 * Creator bookings query layer — READ-ONLY, owner-scoped.
 *
 * Like the dashboard layer, the booking tables are service-role only, so this
 * reads through the `pg` pool and pins EVERY query to a single `creator_id`.
 * A creator can only ever see — and open — their own bookings.
 *
 * Scope: only `confirmed` and `cancelled` bookings are listed. `payment_pending`
 * and `expired` rows are abandoned/in-flight payment attempts that never became
 * real bookings, so they never surface in the list. (The detail view, addressed
 * by id, still renders whatever status an owned booking has.)
 */

export type BookingListStatus = "confirmed" | "cancelled";

export type BookingListItem = {
  id: string;
  serviceTitle: string | null;
  customerName: string | null;
  slotStart: string; // ISO
  slotEnd: string; // ISO
  status: BookingListStatus;
  amountPaise: number;
};

export type GroupedBookings = {
  /** confirmed, slot in the future — soonest first */
  upcoming: BookingListItem[];
  /** confirmed, slot in the past — most recent first */
  past: BookingListItem[];
  /** cancelled — most recent slot first */
  cancelled: BookingListItem[];
};

export type BookingPayment = {
  status: string; // created | pending | captured | failed | expired | refunded
  amountPaise: number;
  currency: string;
};

export type BookingDetail = {
  id: string;
  status: string; // confirmed | cancelled | payment_pending | expired
  serviceTitle: string | null;
  slotStart: string; // ISO
  slotEnd: string; // ISO
  amountPaise: number;
  currency: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  /** latest payment order for the booking, or null if none exists yet */
  payment: BookingPayment | null;
};

function num(v: unknown): number {
  return Number(v ?? 0);
}

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}

/**
 * All of a creator's real bookings, grouped for the bookings page. One scan,
 * partitioned in JS so each group can carry its own ordering.
 */
export async function getCreatorBookings(
  creatorId: string,
  db: Executor = getPool(),
  now: Date = new Date(),
): Promise<GroupedBookings> {
  const { rows } = await db.query(
    `select b.id, b.slot_start, b.slot_end, b.status, b.customer_name, b.amount_paise,
            s.title as service_title
       from public.bookings b
       left join public.services s on s.id = b.service_id
      where b.creator_id = $1
        and b.status in ('confirmed', 'cancelled')`,
    [creatorId],
  );

  const items: (BookingListItem & { _past: boolean })[] = rows.map((r) => {
    const slotStart = iso(r.slot_start);
    return {
      id: String(r.id),
      serviceTitle: r.service_title ?? null,
      customerName: r.customer_name ?? null,
      slotStart,
      slotEnd: iso(r.slot_end),
      status: r.status as BookingListStatus,
      amountPaise: num(r.amount_paise),
      _past: new Date(slotStart).getTime() < now.getTime(),
    };
  });

  const bySlotAsc = (a: BookingListItem, b: BookingListItem) =>
    a.slotStart.localeCompare(b.slotStart);
  const bySlotDesc = (a: BookingListItem, b: BookingListItem) =>
    b.slotStart.localeCompare(a.slotStart);

  const strip = ({ _past, ...item }: BookingListItem & { _past: boolean }): BookingListItem => {
    void _past;
    return item;
  };

  return {
    upcoming: items.filter((i) => i.status === "confirmed" && !i._past).map(strip).sort(bySlotAsc),
    past: items.filter((i) => i.status === "confirmed" && i._past).map(strip).sort(bySlotDesc),
    cancelled: items.filter((i) => i.status === "cancelled").map(strip).sort(bySlotDesc),
  };
}

/**
 * One booking and its latest payment order, or null if the id doesn't exist or
 * isn't owned by this creator. The creator_id predicate is the access control:
 * creator A asking for creator B's booking id gets null (→ 404), never a leak.
 */
export async function getCreatorBookingDetail(
  creatorId: string,
  bookingId: string,
  db: Executor = getPool(),
): Promise<BookingDetail | null> {
  const { rows } = await db.query(
    `select b.id, b.status, b.slot_start, b.slot_end, b.amount_paise, b.currency,
            b.customer_name, b.customer_email, b.customer_phone,
            s.title as service_title
       from public.bookings b
       left join public.services s on s.id = b.service_id
      where b.id = $1 and b.creator_id = $2`,
    [bookingId, creatorId],
  );
  const b = rows[0];
  if (!b) return null;

  const pay = await db.query(
    `select status, amount_paise, currency
       from public.payment_orders
      where booking_id = $1
      order by created_at desc
      limit 1`,
    [bookingId],
  );
  const p = pay.rows[0];

  return {
    id: String(b.id),
    status: String(b.status),
    serviceTitle: b.service_title ?? null,
    slotStart: iso(b.slot_start),
    slotEnd: iso(b.slot_end),
    amountPaise: num(b.amount_paise),
    currency: String(b.currency ?? "INR"),
    customerName: b.customer_name ?? null,
    customerEmail: b.customer_email ?? null,
    customerPhone: b.customer_phone ?? null,
    payment: p ? { status: String(p.status), amountPaise: num(p.amount_paise), currency: String(p.currency ?? "INR") } : null,
  };
}
