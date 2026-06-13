import type { PoolClient } from "pg";
import { pgErrorCode, withTransaction } from "@/lib/db/pool";
import { RecoveryError } from "./errors";
import { getPaymentProvider, type PaymentProvider } from "./provider";
import { classifyProviderState } from "./reconcile";

/**
 * Recovery Service (Phase 8) — SAFE, audited operator recovery. Each action
 * runs in one transaction: it appends a recovery_actions row (append-only,
 * never updated/deleted) and then CREATES WORK that the existing workers
 * consume on their own schedule. It NEVER mutates bookings / booking_locks /
 * payment_orders directly — the Processor remains the sole writer of truth.
 *
 * The only actions that exist are the three safe ones. mark_paid /
 * confirm_booking / release_lock / delete_event / edit_event are absent here
 * and unrepresentable in the recovery_actions.action_type CHECK.
 */

type RecoveryOptions = { performedBy?: string; reason?: string };

/** Append the audit row and return its id. Caller owns the transaction. */
async function audit(
  client: PoolClient,
  opts: {
    actionType: "replay_event" | "retry_reconciliation" | "retry_notification";
    targetType: string;
    targetId: string;
    correlationId: string;
    performedBy?: string;
    reason?: string;
    payload?: Record<string, unknown>;
  },
): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into public.recovery_actions
       (correlation_id, action_type, target_type, target_id, performed_by, reason, payload)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)
     returning id`,
    [
      opts.correlationId,
      opts.actionType,
      opts.targetType,
      opts.targetId,
      opts.performedBy ?? null,
      opts.reason ?? null,
      JSON.stringify(opts.payload ?? {}),
    ],
  );
  return rows[0].id;
}

/**
 * Replay a payment event: re-queue it for the Processor by clearing its
 * processed flag (the immutability guard permits only this). The Processor
 * re-applies it idempotently — no booking state is touched here.
 */
export async function replayEvent(
  eventId: string,
  opts: RecoveryOptions = {},
): Promise<{ recoveryActionId: string; eventId: string }> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ correlation_id: string }>(
      `select correlation_id from public.payment_events where id = $1`,
      [eventId],
    );
    if (!rows[0]) throw new RecoveryError(`payment_event ${eventId} not found`);

    const recoveryActionId = await audit(client, {
      actionType: "replay_event",
      targetType: "payment_event",
      targetId: eventId,
      correlationId: rows[0].correlation_id,
      performedBy: opts.performedBy,
      reason: opts.reason,
    });

    await client.query(
      `update public.payment_events set processed = false, processed_at = null where id = $1`,
      [eventId],
    );
    return { recoveryActionId, eventId };
  });
}

/**
 * Retry reconciliation for an order: ask the provider what really happened and,
 * if definitive, emit a deterministic reconciliation event (the Phase 6
 * contract) for the Processor to consume. Writes no bookings / booking_locks /
 * payment_orders. An indefinite provider state emits nothing — never guess.
 */
export async function retryReconciliation(
  orderId: string,
  opts: RecoveryOptions & { provider?: PaymentProvider } = {},
): Promise<{ recoveryActionId: string; emitted: "captured" | "failed" | "none"; eventId?: string }> {
  const provider = opts.provider ?? getPaymentProvider();
  return withTransaction(async (client) => {
    const { rows } = await client.query<{
      correlation_id: string;
      provider_order_id: string | null;
      provider_payment_id: string | null;
    }>(
      `select correlation_id, provider_order_id, provider_payment_id
         from public.payment_orders where id = $1`,
      [orderId],
    );
    const order = rows[0];
    if (!order) throw new RecoveryError(`payment_order ${orderId} not found`);
    if (!order.provider_order_id) throw new RecoveryError(`payment_order ${orderId} has no provider_order_id`);

    const providerOrder = await provider.getOrderStatus(order.provider_order_id);
    const providerPayment = order.provider_payment_id
      ? await provider.getPaymentStatus(order.provider_payment_id)
      : null;
    const state = classifyProviderState(providerOrder, providerPayment);
    const resolution = state === "captured" ? "captured" : state === "failed" || state === "expired" ? "failed" : "none";

    const recoveryActionId = await audit(client, {
      actionType: "retry_reconciliation",
      targetType: "payment_order",
      targetId: orderId,
      correlationId: order.correlation_id,
      performedBy: opts.performedBy,
      reason: opts.reason,
      payload: { providerOrder, providerPayment, classified: state },
    });

    if (resolution === "none") return { recoveryActionId, emitted: "none" };

    const providerEventId = `recon:${order.provider_order_id}:${resolution}`;
    try {
      const { rows: ev } = await client.query<{ id: string }>(
        `insert into public.payment_events
           (correlation_id, event_source, event_type, provider_event_id, payment_order_id, payload)
         values ($1, 'reconciliation', $2, $3, $4, $5::jsonb)
         returning id`,
        [
          order.correlation_id,
          `reconciliation.${resolution}`,
          providerEventId,
          orderId,
          JSON.stringify({ providerOrder, providerPayment, classified: state }),
        ],
      );
      return { recoveryActionId, emitted: resolution, eventId: ev[0].id };
    } catch (err) {
      // a prior sweep/retry already emitted this exact verdict — the work exists
      if (pgErrorCode(err) === "23505") return { recoveryActionId, emitted: resolution };
      throw err;
    }
  });
}

/**
 * Retry a notification: move it back to pending with a fresh retry budget so the
 * Notification Worker re-attempts delivery. Touches only notification_queue.
 */
export async function retryNotification(
  notificationId: string,
  opts: RecoveryOptions = {},
): Promise<{ recoveryActionId: string; notificationId: string }> {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ correlation_id: string }>(
      `select correlation_id from public.notification_queue where id = $1`,
      [notificationId],
    );
    if (!rows[0]) throw new RecoveryError(`notification ${notificationId} not found`);

    const recoveryActionId = await audit(client, {
      actionType: "retry_notification",
      targetType: "notification_queue",
      targetId: notificationId,
      correlationId: rows[0].correlation_id,
      performedBy: opts.performedBy,
      reason: opts.reason,
    });

    await client.query(
      `update public.notification_queue
          set status = 'pending', attempt_count = 0, next_attempt_at = now(),
              processing_expires_at = null
        where id = $1`,
      [notificationId],
    );
    return { recoveryActionId, notificationId };
  });
}
