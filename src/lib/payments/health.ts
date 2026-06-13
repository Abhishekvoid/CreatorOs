import { getPool, type Executor } from "@/lib/db/pool";

/**
 * Payment Health Service (Phase 8) — READ-ONLY. A single aggregate snapshot of
 * the funnel, the work backlog, and how stale the oldest pending work is. It
 * performs no writes and never touches business truth; it only counts.
 */

export type PaymentHealth = {
  funnel: {
    bookingsStarted: number;
    ordersCreated: number;
    paymentsCaptured: number;
    bookingsConfirmed: number;
    notificationsQueued: number;
    notificationsSent: number;
  };
  backlog: {
    unprocessedEvents: number;
    pendingReconciliation: number;
    pendingNotifications: number;
    deadLetterNotifications: number;
  };
  lag: {
    oldestUnprocessedEventSeconds: number | null;
    oldestPendingReconciliationSeconds: number | null;
    oldestPendingNotificationSeconds: number | null;
  };
};

/** float8/bigint come back as strings or null; normalise to number | null. */
function num(v: unknown): number {
  return Number(v ?? 0);
}
function numOrNull(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v);
}

export async function getPaymentHealth(db: Executor = getPool()): Promise<PaymentHealth> {
  const { rows } = await db.query(`
    select
      (select count(*) from public.bookings)                                       as bookings_started,
      (select count(*) from public.payment_orders)                                 as orders_created,
      (select count(*) from public.payment_orders where status = 'captured')       as payments_captured,
      (select count(*) from public.bookings where status = 'confirmed')            as bookings_confirmed,
      (select count(*) from public.notification_queue)                             as notifications_queued,
      (select count(*) from public.notification_queue where status = 'sent')       as notifications_sent,
      (select count(*) from public.payment_events where processed = false)         as unprocessed_events,
      (select count(*) from public.booking_locks where status = 'pending_reconciliation') as pending_reconciliation,
      (select count(*) from public.notification_queue where status = 'pending')    as pending_notifications,
      (select count(*) from public.notification_queue where status = 'dead_letter') as dead_letter_notifications,
      (select extract(epoch from (now() - min(created_at)))
         from public.payment_events where processed = false)                       as oldest_unprocessed_event_seconds,
      (select extract(epoch from (now() - min(expires_at)))
         from public.booking_locks where status = 'pending_reconciliation')        as oldest_pending_reconciliation_seconds,
      (select extract(epoch from (now() - min(created_at)))
         from public.notification_queue where status = 'pending')                  as oldest_pending_notification_seconds
  `);
  const r = rows[0];
  return {
    funnel: {
      bookingsStarted: num(r.bookings_started),
      ordersCreated: num(r.orders_created),
      paymentsCaptured: num(r.payments_captured),
      bookingsConfirmed: num(r.bookings_confirmed),
      notificationsQueued: num(r.notifications_queued),
      notificationsSent: num(r.notifications_sent),
    },
    backlog: {
      unprocessedEvents: num(r.unprocessed_events),
      pendingReconciliation: num(r.pending_reconciliation),
      pendingNotifications: num(r.pending_notifications),
      deadLetterNotifications: num(r.dead_letter_notifications),
    },
    lag: {
      oldestUnprocessedEventSeconds: numOrNull(r.oldest_unprocessed_event_seconds),
      oldestPendingReconciliationSeconds: numOrNull(r.oldest_pending_reconciliation_seconds),
      oldestPendingNotificationSeconds: numOrNull(r.oldest_pending_notification_seconds),
    },
  };
}
