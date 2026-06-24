import type { PoolClient } from "pg";
import { confirmBooking, releaseLock } from "@/lib/booking";
import { upsertClientForBooking } from "@/lib/clients";
import { withTransaction } from "@/lib/db/pool";

/**
 * Payment Processor Worker (Phase 5) — the SOLE writer of business truth.
 *
 * It consumes the immutable payment_events ledger and is the only component
 * permitted to mutate payment_orders / bookings / booking_locks or write
 * notification_queue. Each event is applied in ONE transaction with
 * state-guarded statements; any failure rolls the whole transaction back and
 * leaves the event unprocessed for a later retry. Replays and out-of-order
 * deliveries are absorbed by the guards (and, for notifications, by the
 * notification_queue identity constraint). It queues notifications but sends
 * nothing — delivery is Phase 7.
 */

export type ClaimableEvent = {
  id: string;
  event_source: string;
  event_type: string;
  payment_order_id: string;
  correlation_id: string;
};

type Outcome = "captured" | "failed" | "unknown";

/**
 * Frozen (event_source, event_type) → outcome map. Webhook and reconciliation
 * of the same outcome drive the identical transition; every other pair is
 * unknown (mark processed, no business change).
 */
function classify(source: string, type: string): Outcome {
  const key = `${source}:${type}`;
  switch (key) {
    case "webhook:payment.captured":
    case "webhook:order.paid":
    case "reconciliation:reconciliation.captured":
      return "captured";
    case "webhook:payment.failed":
    case "reconciliation:reconciliation.failed":
      return "failed";
    default:
      return "unknown";
  }
}

/**
 * Claim the oldest unprocessed, LINKED event with a row lock. Unlinked events
 * (payment_order_id is null) are intentionally excluded — they are anomalies
 * left untouched for Phase 8 monitoring, and skipping them keeps the worker
 * from head-of-line-blocking. FOR UPDATE SKIP LOCKED guarantees that with
 * multiple workers, at most one claims any given event.
 */
export async function claimNext(client: PoolClient): Promise<ClaimableEvent | null> {
  const { rows } = await client.query<ClaimableEvent>(
    `select id, event_source, event_type, payment_order_id, correlation_id
       from public.payment_events
      where processed = false
        and payment_order_id is not null
      order by created_at
      for update skip locked
      limit 1`,
  );
  return rows[0] ?? null;
}

/** Enqueue a notification only if the booking actually reached `expectedStatus`. */
async function enqueue(
  client: PoolClient,
  bookingId: string,
  type: string,
  expectedStatus: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await client.query(
    `insert into public.notification_queue (correlation_id, booking_id, type, channel, payload)
     select b.correlation_id, b.id, $2, 'whatsapp', $3::jsonb
       from public.bookings b
      where b.id = $1 and b.status = $4
     on conflict (booking_id, type) do nothing`,
    [bookingId, type, JSON.stringify(payload), expectedStatus],
  );
}

async function markProcessed(client: PoolClient, eventId: string): Promise<void> {
  await client.query(
    `update public.payment_events set processed = true, processed_at = now() where id = $1`,
    [eventId],
  );
}

/**
 * Apply one claimed event inside the caller's transaction. Every write is
 * state-guarded, so re-applying the same event (or applying a superseded one)
 * is a no-op rather than an error. The caller owns the transaction boundary;
 * throwing here rolls everything back.
 */
export async function applyEvent(client: PoolClient, event: ClaimableEvent): Promise<Outcome> {
  const outcome = classify(event.event_source, event.event_type);
  if (outcome === "unknown") {
    await markProcessed(client, event.id);
    return "unknown";
  }

  const { rows } = await client.query<{ booking_id: string }>(
    `select booking_id from public.payment_orders where id = $1`,
    [event.payment_order_id],
  );
  const bookingId = rows[0]?.booking_id;
  if (!bookingId) {
    // linked order disappeared — nothing to drive; don't crash the worker.
    await markProcessed(client, event.id);
    return "unknown";
  }

  if (outcome === "captured") {
    await client.query(
      `update public.payment_orders
          set status = 'captured', captured_at = now(), caused_by_event_id = $2, updated_at = now()
        where id = $1 and status in ('created', 'pending')`,
      [event.payment_order_id, event.id],
    );
    const { bookingConfirmed } = await confirmBooking({ bookingId }, client);
    // Build the creator's CRM (FR-40). Gate on bookingConfirmed so this runs
    // exactly once per booking — its first payment_pending -> confirmed flip.
    // A replayed/out-of-order event re-runs confirmBooking, which no-ops, so
    // booking_count / lifetime_spend never double-count. Same transaction:
    // the client record commits atomically with the confirmation or not at all.
    if (bookingConfirmed) {
      await upsertClientForBooking(client, bookingId);
    }
    await enqueue(client, bookingId, "creator_confirmation", "confirmed", { recipient: "creator", kind: "confirmation" });
    await enqueue(client, bookingId, "client_confirmation", "confirmed", { recipient: "client", kind: "confirmation" });
  } else {
    await client.query(
      `update public.payment_orders
          set status = 'failed', failed_at = now(), caused_by_event_id = $2, updated_at = now()
        where id = $1 and status in ('created', 'pending')`,
      [event.payment_order_id, event.id],
    );
    await releaseLock({ bookingId }, client);
    await enqueue(client, bookingId, "creator_cancellation", "cancelled", { recipient: "creator", kind: "cancellation" });
    await enqueue(client, bookingId, "client_cancellation", "cancelled", { recipient: "client", kind: "cancellation" });
  }

  await markProcessed(client, event.id);
  return outcome;
}

export type ProcessSummary = { processed: number };

/**
 * Drain claimable events, one transaction per event (claim + apply + commit),
 * up to `limit` events. Stops when nothing remains claimable. Safe to run from
 * multiple workers concurrently — SKIP LOCKED hands each event to one worker.
 */
export async function processPendingEvents(opts: { limit?: number } = {}): Promise<ProcessSummary> {
  const limit = opts.limit ?? 100;
  let processed = 0;
  for (let i = 0; i < limit; i++) {
    const claimed = await withTransaction(async (client) => {
      const event = await claimNext(client);
      if (!event) return false;
      await applyEvent(client, event);
      return true;
    });
    if (!claimed) break;
    processed++;
  }
  return { processed };
}
