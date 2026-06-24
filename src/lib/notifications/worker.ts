import type { PoolClient } from "pg";
import { getPool, withTransaction } from "@/lib/db/pool";
import {
  getNotificationProvider,
  type NotificationMessage,
  type NotificationProvider,
  type NotificationResult,
} from "./provider";

/**
 * Notification Worker (Phase 7) — eventual notification delivery, downstream of
 * truth. It drains notification_queue rows the Processor enqueued, hands each to
 * a pluggable provider, and drives the state machine:
 *
 *   pending → processing → sent
 *   pending → processing → failed → pending   (backoff retry)
 *   pending → processing → dead_letter         (attempts exhausted)
 *
 * HARD INVARIANT: this worker's SQL targets ONLY public.notification_queue. It
 * never reads or writes bookings / booking_locks / payment_orders /
 * payment_events. A provider outage may delay notifications; it can never
 * affect payment, booking, or lock state. Rows are never deleted.
 *
 * Delivery is split across two committed transactions with the provider call in
 * between, OUTSIDE any held row lock — so a slow or down provider never holds a
 * database lock:
 *   1. claim + lease  (pending → processing, set processing_expires_at)
 *   2. provider.send(...)
 *   3. record outcome (processing → sent | pending | dead_letter)
 * A crash between (1) and (3) leaves a processing row; reapStuckNotifications
 * returns it to pending once the lease lapses, so nothing is stranded forever.
 */

/** How long a claimed row stays leased to one worker before the reaper recovers it. */
export const PROCESSING_LEASE_SECONDS = 120;

/**
 * Retry backoff in minutes, indexed by the just-failed attempt number. Four
 * delays are defined; a failure with no remaining delay (the 5th) dead-letters.
 */
export const BACKOFF_MINUTES = [1, 5, 15, 60] as const;

export type ClaimedNotification = {
  id: string;
  type: string;
  channel: "whatsapp" | "email";
  payload: Record<string, unknown>;
  booking_id: string | null;
  correlation_id: string;
  attempt_count: number;
};

/**
 * Claim the oldest-due pending row and lease it (pending → processing) in one
 * atomic statement. attempt_count is intentionally NOT incremented here — only a
 * recorded provider failure consumes a retry, so a crash (recovered by the
 * reaper) costs nothing. FOR UPDATE SKIP LOCKED guarantees that with multiple
 * workers, at most one claims any given row. The caller owns the transaction.
 */
export async function claimAndLease(
  client: PoolClient,
  leaseSeconds: number = PROCESSING_LEASE_SECONDS,
): Promise<ClaimedNotification | null> {
  const { rows } = await client.query<ClaimedNotification>(
    `with claimed as (
       select id from public.notification_queue
        where status = 'pending' and next_attempt_at <= now()
        order by next_attempt_at
        for update skip locked
        limit 1
     )
     update public.notification_queue q
        set status = 'processing',
            processing_expires_at = now() + make_interval(secs => $1::int)
       from claimed
      where q.id = claimed.id
     returning q.id, q.type, q.channel, q.payload, q.booking_id, q.correlation_id, q.attempt_count`,
    [leaseSeconds],
  );
  return rows[0] ?? null;
}

function toMessage(claimed: ClaimedNotification): NotificationMessage {
  return {
    id: claimed.id,
    correlationId: claimed.correlation_id,
    bookingId: claimed.booking_id,
    type: claimed.type,
    channel: claimed.channel,
    payload: claimed.payload,
  };
}

type RecordedOutcome = "sent" | "failed" | "dead_letter";

/**
 * Record the result of one delivery attempt. Every write is guarded by
 * `status = 'processing'`, so if the reaper or a concurrent worker already moved
 * the row, this is a no-op rather than a clobber. On failure we increment
 * attempt_count and either reschedule with backoff or dead-letter when the
 * schedule is exhausted.
 */
async function recordOutcome(
  client: PoolClient,
  claimed: ClaimedNotification,
  result: NotificationResult,
): Promise<RecordedOutcome> {
  if (result.ok) {
    await client.query(
      `update public.notification_queue
          set status = 'sent', sent_at = now(), processing_expires_at = null, last_error = null
        where id = $1 and status = 'processing'`,
      [claimed.id],
    );
    return "sent";
  }

  const nextAttempt = claimed.attempt_count + 1;

  // A permanent failure (e.g. a provider 4xx, or a malformed message) can never
  // succeed on retry — dead-letter it immediately rather than burning the whole
  // backoff schedule. Retryable failures (the default) keep the existing path.
  if (result.retryable === false) {
    await client.query(
      `update public.notification_queue
          set status = 'dead_letter', attempt_count = $2, last_error = $3, processing_expires_at = null
        where id = $1 and status = 'processing'`,
      [claimed.id, nextAttempt, result.error],
    );
    return "dead_letter";
  }

  const delayMinutes = BACKOFF_MINUTES[nextAttempt - 1];

  if (delayMinutes === undefined) {
    await client.query(
      `update public.notification_queue
          set status = 'dead_letter', attempt_count = $2, last_error = $3, processing_expires_at = null
        where id = $1 and status = 'processing'`,
      [claimed.id, nextAttempt, result.error],
    );
    return "dead_letter";
  }

  await client.query(
    `update public.notification_queue
        set status = 'pending', attempt_count = $2, last_error = $3,
            next_attempt_at = now() + make_interval(mins => $4::int),
            processing_expires_at = null
      where id = $1 and status = 'processing'`,
    [claimed.id, nextAttempt, result.error, delayMinutes],
  );
  return "failed";
}

/** Deliver one claimed notification: send (outside any txn), then record the outcome. */
async function deliver(
  claimed: ClaimedNotification,
  provider: NotificationProvider,
): Promise<RecordedOutcome> {
  let result: NotificationResult;
  try {
    result = await provider.send(toMessage(claimed));
  } catch (err) {
    result = { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
  return withTransaction((client) => recordOutcome(client, claimed, result));
}

export type ProcessNotificationsSummary = {
  processed: number;
  sent: number;
  failed: number;
  dead_letter: number;
};

/**
 * Drain claimable notifications, up to `limit`, one at a time. Safe to run from
 * multiple workers concurrently (SKIP LOCKED). Returns a tally of outcomes.
 */
export async function processNotifications(
  opts: { limit?: number; provider?: NotificationProvider } = {},
): Promise<ProcessNotificationsSummary> {
  const limit = opts.limit ?? 100;
  const provider = opts.provider ?? getNotificationProvider();
  const summary: ProcessNotificationsSummary = { processed: 0, sent: 0, failed: 0, dead_letter: 0 };

  for (let i = 0; i < limit; i++) {
    const claimed = await withTransaction((client) => claimAndLease(client));
    if (!claimed) break;
    const outcome = await deliver(claimed, provider);
    summary.processed++;
    if (outcome === "sent") summary.sent++;
    else if (outcome === "failed") summary.failed++;
    else summary.dead_letter++;
  }

  return summary;
}

/**
 * Recover rows stranded in `processing` past their lease (a crashed worker)
 * back to `pending` so they are retried. attempt_count is left untouched — a
 * crash never burns a retry. Returns how many rows were requeued.
 */
export async function reapStuckNotifications(): Promise<{ requeued: number }> {
  const { rows } = await getPool().query<{ id: string }>(
    `update public.notification_queue
        set status = 'pending', processing_expires_at = null
      where status = 'processing' and processing_expires_at < now()
     returning id`,
  );
  return { requeued: rows.length };
}
