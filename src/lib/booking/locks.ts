import type { PoolClient } from "pg";
import { type Executor, getPool, pgErrorCode, withTransaction } from "@/lib/db/pool";
import { SlotUnavailableError } from "./errors";

/**
 * Slot locks and booking-lifecycle transitions. No Razorpay or payment
 * knowledge lives here — payment concerns start in Phase 3. The processor
 * (Phase 5) calls confirmBooking / releaseLock from inside its own
 * transaction by passing its PoolClient.
 */

const LIVE_LOCK_STATUSES = ["active", "pending_reconciliation", "confirmed"] as const;

export type AcquireLockInput = {
  creatorId: string;
  slotStart: string; // ISO timestamptz
  slotEnd: string; // ISO timestamptz
  bookingId: string;
  correlationId: string;
};

/** A 10-minute hold, matching the booking flow's payment window. */
const LOCK_TTL = "10 minutes";

/**
 * Acquire a slot lock.
 *
 * The INSERT *is* the availability check: we never pre-query for existing
 * locks (that would open a TOCTOU race). The partial unique index
 * booking_lock_active_slot_idx rejects a second live lock on the same
 * creator+slot with 23505, which we surface as SlotUnavailableError.
 */
export async function acquireLock(
  input: AcquireLockInput,
  exec: Executor = getPool(),
): Promise<{ id: string }> {
  try {
    const { rows } = await exec.query<{ id: string }>(
      `insert into public.booking_locks
         (correlation_id, booking_id, creator_id, slot_start, slot_end, status, expires_at)
       values ($1, $2, $3, $4, $5, 'active', now() + interval '${LOCK_TTL}')
       returning id`,
      [input.correlationId, input.bookingId, input.creatorId, input.slotStart, input.slotEnd],
    );
    return { id: rows[0].id };
  } catch (err) {
    if (pgErrorCode(err) === "23505") {
      throw new SlotUnavailableError(input.creatorId, input.slotStart);
    }
    throw err;
  }
}

/**
 * Sweep expired holds: active -> pending_reconciliation where the 10-minute
 * window has elapsed. Timer expiry NEVER releases a lock or frees the slot —
 * a late UPI capture could still arrive, so the slot must stay blocked until
 * reconciliation verifies the provider's truth. State-guarded on 'active'.
 */
export async function expireToReconciliation(exec: Executor = getPool()): Promise<{ expired: string[] }> {
  const { rows } = await exec.query<{ id: string }>(
    `update public.booking_locks
        set status = 'pending_reconciliation'
      where status = 'active'
        and expires_at < now()
      returning id`,
  );
  return { expired: rows.map((r) => r.id) };
}

/**
 * Confirm a booking once payment is captured. Transitions the live lock
 * (active | pending_reconciliation) -> confirmed and the booking
 * payment_pending -> confirmed, both state-guarded, in one transaction.
 * Any other current state is a no-op (returns false), so replays can't
 * downgrade or double-apply.
 */
export async function confirmBooking(
  input: { bookingId: string },
  client?: PoolClient,
): Promise<{ lockConfirmed: boolean; bookingConfirmed: boolean }> {
  const run = async (c: Executor) => {
    const lock = await c.query(
      `update public.booking_locks
          set status = 'confirmed', confirmed_at = now()
        where booking_id = $1
          and status in ('active', 'pending_reconciliation')`,
      [input.bookingId],
    );
    const booking = await c.query(
      `update public.bookings
          set status = 'confirmed'
        where id = $1
          and status = 'payment_pending'`,
      [input.bookingId],
    );
    return {
      lockConfirmed: (lock.rowCount ?? 0) > 0,
      bookingConfirmed: (booking.rowCount ?? 0) > 0,
    };
  };
  return client ? run(client) : withTransaction(run);
}

/**
 * Release a slot after a VERIFIED payment failure. Transitions the live lock
 * (active | pending_reconciliation) -> released and the booking
 * payment_pending -> cancelled, both state-guarded, in one transaction.
 * Never called by timers or by availability logic — only by the processor
 * acting on a confirmed provider failure.
 */
export async function releaseLock(
  input: { bookingId: string },
  client?: PoolClient,
): Promise<{ lockReleased: boolean; bookingCancelled: boolean }> {
  const run = async (c: Executor) => {
    const lock = await c.query(
      `update public.booking_locks
          set status = 'released', released_at = now()
        where booking_id = $1
          and status in ('active', 'pending_reconciliation')`,
      [input.bookingId],
    );
    const booking = await c.query(
      `update public.bookings
          set status = 'cancelled'
        where id = $1
          and status = 'payment_pending'`,
      [input.bookingId],
    );
    return {
      lockReleased: (lock.rowCount ?? 0) > 0,
      bookingCancelled: (booking.rowCount ?? 0) > 0,
    };
  };
  return client ? run(client) : withTransaction(run);
}

export { LIVE_LOCK_STATUSES };
