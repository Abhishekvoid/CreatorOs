import { getAvailability, type AvailableSlot } from "@/lib/booking";
import { getPool, type Executor } from "@/lib/db/pool";
import { initiate, type PaymentProvider } from "@/lib/payments";

/**
 * Booking entry points the public UI is a thin shell over. Server-only.
 *
 *  - getCreatorSlots  : availability for a creator+service (reads booking_locks
 *                       via the Booking Service — Rule 5; occupied & pending-
 *                       reconciliation slots are already excluded).
 *  - initiateBooking  : resolve handle+service, derive amount/slotEnd from the
 *                       DB (NEVER the client), and call the Phase 3 orchestrator.
 *  - getBookingStatus : READ-ONLY status for the confirming screen's poll.
 *
 * None of these confirm anything — confirmation flows only through the frozen
 * webhook/sweep → Processor pipeline.
 */

export class CreatorNotFoundError extends Error {
  constructor(handle: string) {
    super(`No published creator for handle '${handle}'`);
    this.name = "CreatorNotFoundError";
  }
}
export class ServiceNotFoundError extends Error {
  constructor(serviceId: string) {
    super(`No active booking service '${serviceId}' for this creator`);
    this.name = "ServiceNotFoundError";
  }
}

/** Resolve a published creator id from a handle. */
async function resolveCreatorId(handle: string, db: Executor): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `select id from public.profiles where handle = $1 and is_published = true`,
    [handle],
  );
  if (!rows[0]) throw new CreatorNotFoundError(handle);
  return rows[0].id;
}

type ServiceFacts = { pricePaise: number; durationMinutes: number };

/** Load an active booking service that belongs to the creator. */
async function resolveService(creatorId: string, serviceId: string, db: Executor): Promise<ServiceFacts> {
  const { rows } = await db.query<{ price_paise: number; duration_minutes: number | null }>(
    `select price_paise, duration_minutes
       from public.services
      where id = $1 and profile_id = $2 and is_active = true and type = 'booking'`,
    [serviceId, creatorId],
  );
  if (!rows[0]) throw new ServiceNotFoundError(serviceId);
  return { pricePaise: rows[0].price_paise, durationMinutes: rows[0].duration_minutes ?? 60 };
}

export async function getCreatorSlots(
  input: { handle: string; serviceId: string; from: string; to: string },
  db: Executor = getPool(),
): Promise<AvailableSlot[]> {
  const creatorId = await resolveCreatorId(input.handle, db);
  const { durationMinutes } = await resolveService(creatorId, input.serviceId, db);
  return getAvailability(
    { creatorId, from: input.from, to: input.to, slotMinutes: durationMinutes },
    db,
  );
}

export type InitiateBookingInput = {
  creatorHandle: string;
  serviceId: string;
  slotStart: string; // ISO
  customerName: string;
  customerEmail: string;
  customerPhone: string;
};

export type InitiateBookingResult = {
  correlationId: string;
  orderId: string;
  amount: number; // paise
  key: string; // public Razorpay key id ("" in keyless mode)
};

export async function initiateBooking(
  input: InitiateBookingInput,
  opts: { provider?: PaymentProvider } = {},
): Promise<InitiateBookingResult> {
  const pool = getPool();
  const creatorId = await resolveCreatorId(input.creatorHandle, pool);
  const { pricePaise, durationMinutes } = await resolveService(creatorId, input.serviceId, pool);
  const slotEnd = new Date(new Date(input.slotStart).getTime() + durationMinutes * 60_000).toISOString();

  const payload = await initiate(
    {
      creatorId,
      serviceId: input.serviceId,
      slotStart: input.slotStart,
      slotEnd,
      amountPaise: pricePaise,
      customer: { name: input.customerName, email: input.customerEmail, phone: input.customerPhone },
    },
    opts,
  );

  return {
    correlationId: payload.correlationId,
    orderId: payload.orderId,
    amount: payload.amountPaise,
    key: process.env.RAZORPAY_KEY_ID ?? "",
  };
}

export type BookingStatus = { bookingId: string; status: string };

/** READ-ONLY status for the confirming poller. Never mutates. */
export async function getBookingStatus(
  correlationId: string,
  db: Executor = getPool(),
): Promise<BookingStatus | null> {
  const { rows } = await db.query<{ id: string; status: string }>(
    `select id, status from public.bookings where correlation_id = $1 order by created_at limit 1`,
    [correlationId],
  );
  return rows[0] ? { bookingId: rows[0].id, status: rows[0].status } : null;
}
