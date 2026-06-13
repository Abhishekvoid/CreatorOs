import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { initiate, processPendingEvents } from "@/lib/payments";
import type { PaymentProvider } from "@/lib/payments";
import { getPaymentHealth } from "@/lib/payments/health";
import { runIntegrityChecks } from "@/lib/payments/integrity";
import { getDashboardData } from "@/lib/payments/dashboard";
import { replayEvent, retryReconciliation, retryNotification } from "@/lib/payments/recovery";
import { applySchema, makePool, seedBooking, seedCreator, uniqueSlot } from "./helpers";

/**
 * Phase 8 — Monitoring, Integrity & Recovery against real Postgres (no mocks).
 *
 * Read-only health/integrity/dashboard plus safe recovery that only CREATES
 * WORK (re-queue an event, emit a reconciliation event, re-pend a notification)
 * and audits it in recovery_actions. The Processor remains the sole writer of
 * truth — recovery never mutates bookings / booking_locks / payment_orders.
 *
 * Each test re-applies the schema for a clean, globally-isolated database
 * (integrity scans the whole DB).
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  delete process.env.PAYMENT_PROVIDER; // test mode → synthetic order, no network
});

afterAll(async () => {
  await pool.end();
});

beforeEach(async () => {
  await applySchema(pool);
});

/** Provider double: canned order/payment status (mirrors the Phase 6 seam). */
function fakeProvider(orderStatus: string, paymentStatus?: string): PaymentProvider {
  return {
    getProviderName: () => "razorpay_test",
    createOrder: async () => { throw new Error("unused"); },
    verifyWebhookSignature: () => { throw new Error("unused"); },
    getOrderStatus: async (orderId: string) => ({ orderId, status: orderStatus, amountPaise: 149900 }),
    getPaymentStatus: async (paymentId: string) => ({ paymentId, orderId: null, status: paymentStatus ?? "unknown", amountPaise: 149900 }),
    refundPayment: async () => { throw new Error("unused"); },
  };
}

/** A booking driven to confirmed through the real processor; returns the captured event id too. */
async function seedConfirmedFlow(): Promise<{
  bookingId: string;
  paymentOrderId: string;
  correlationId: string;
  orderId: string;
  eventId: string;
}> {
  const creator = await seedCreator(pool);
  const slot = uniqueSlot();
  const out = await initiate({ creatorId: creator, slotStart: slot.start, slotEnd: slot.end, amountPaise: 149900 });
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.payment_events
       (correlation_id, event_source, event_type, provider_event_id, payment_order_id, payload)
     values ($1, 'webhook', 'payment.captured', $2, $3, '{}'::jsonb)
     returning id`,
    [out.correlationId, `evt_${randomUUID().slice(0, 12)}`, out.paymentOrderId],
  );
  await processPendingEvents();
  return { ...out, eventId: rows[0].id };
}

async function recoveryActions(targetId: string): Promise<
  Array<{ action_type: string; target_type: string; correlation_id: string; performed_by: string | null; reason: string | null }>
> {
  const { rows } = await pool.query(
    `select action_type, target_type, correlation_id, performed_by, reason
       from public.recovery_actions where target_id = $1 order by created_at`,
    [targetId],
  );
  return rows;
}

/** Snapshot the three truth tables (counts + ordered status strings). */
async function truthSnapshot(): Promise<Record<string, unknown>> {
  const { rows } = await pool.query(`
    select
      (select count(*) from public.bookings)::int as bookings,
      (select count(*) from public.booking_locks)::int as locks,
      (select count(*) from public.payment_orders)::int as orders,
      (select coalesce(string_agg(status, ',' order by id::text), '') from public.bookings) as booking_statuses,
      (select coalesce(string_agg(status, ',' order by id::text), '') from public.booking_locks) as lock_statuses,
      (select coalesce(string_agg(status, ',' order by id::text), '') from public.payment_orders) as order_statuses
  `);
  return rows[0];
}

function checkIds(result: { violations: Array<{ check: string }> }): string[] {
  return result.violations.map((v) => v.check);
}

// =========================================================================

describe("integrity worker", () => {
  it("(1) all checks pass on healthy confirmed data", async () => {
    await seedConfirmedFlow();
    const result = await runIntegrityChecks();
    expect(result.violations).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("(2) detects a confirmed booking whose lock is not confirmed", async () => {
    const creator = await seedCreator(pool);
    const slot = uniqueSlot();
    const correlationId = randomUUID();
    const bookingId = await seedBooking(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end, correlationId });
    // a lock LINKED to the booking, left 'active'
    await pool.query(
      `insert into public.booking_locks (correlation_id, booking_id, creator_id, slot_start, slot_end, status, expires_at)
       values ($1, $2, $3, $4, $5, 'active', now() + interval '10 minutes')`,
      [correlationId, bookingId, creator, slot.start, slot.end],
    );
    // corrupt truth directly, bypassing the processor
    await pool.query(`update public.bookings set status = 'confirmed' where id = $1`, [bookingId]);

    const result = await runIntegrityChecks();
    expect(result.passed).toBe(false);
    expect(checkIds(result)).toContain("confirmed_booking_unconfirmed_lock");
  });

  it("(3) detects a captured order without a confirmed booking", async () => {
    const creator = await seedCreator(pool);
    const slot = uniqueSlot();
    const correlationId = randomUUID();
    const bookingId = await seedBooking(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end, correlationId });
    await pool.query(
      `insert into public.payment_orders (correlation_id, booking_id, provider, amount_paise, status)
       values ($1, $2, 'razorpay', 149900, 'captured')`,
      [correlationId, bookingId],
    );
    // booking left at payment_pending → captured order without a confirmed booking

    const result = await runIntegrityChecks();
    expect(result.passed).toBe(false);
    expect(checkIds(result)).toContain("captured_order_unconfirmed_booking");
  });

  it("the action_type CHECK forbids money-moving recovery actions", async () => {
    for (const forbidden of ["mark_paid", "confirm_booking", "release_lock", "delete_event", "edit_event"]) {
      await expect(
        pool.query(
          `insert into public.recovery_actions (correlation_id, action_type, target_type, target_id)
           values (gen_random_uuid(), $1, 'x', gen_random_uuid())`,
          [forbidden],
        ),
      ).rejects.toThrow();
    }
  });
});

describe("recovery service — audit + create work, never mutate truth", () => {
  it("(4) replayEvent writes a recovery_actions row and re-queues the event", async () => {
    const s = await seedConfirmedFlow();
    const operator = randomUUID();
    const res = await replayEvent(s.eventId, { performedBy: operator, reason: "manual replay" });

    const actions = await recoveryActions(s.eventId);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      action_type: "replay_event",
      target_type: "payment_event",
      correlation_id: s.correlationId,
      performed_by: operator,
      reason: "manual replay",
    });
    expect(res.recoveryActionId).toBeTruthy();

    // the event is back to unprocessed (work for the processor), nothing else
    const { rows } = await pool.query<{ processed: boolean }>(
      `select processed from public.payment_events where id = $1`,
      [s.eventId],
    );
    expect(rows[0].processed).toBe(false);
  });

  it("(5) retryReconciliation writes an audit row and emits a reconciliation event", async () => {
    const creator = await seedCreator(pool);
    const slot = uniqueSlot();
    const out = await initiate({ creatorId: creator, slotStart: slot.start, slotEnd: slot.end, amountPaise: 149900 });

    const res = await retryReconciliation(out.paymentOrderId, {
      provider: fakeProvider("paid"),
      performedBy: randomUUID(),
      reason: "stuck order",
    });
    expect(res.emitted).toBe("captured");

    const actions = await recoveryActions(out.paymentOrderId);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ action_type: "retry_reconciliation", target_type: "payment_order" });

    const { rows } = await pool.query<{ event_type: string; event_source: string }>(
      `select event_type, event_source from public.payment_events where payment_order_id = $1`,
      [out.paymentOrderId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ event_type: "reconciliation.captured", event_source: "reconciliation" });
  });

  it("(6) retryNotification writes an audit row and re-pends the notification", async () => {
    const creator = await seedCreator(pool);
    const slot = uniqueSlot();
    const correlationId = randomUUID();
    const bookingId = await seedBooking(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end, correlationId });
    const { rows: [{ id: notifId }] } = await pool.query<{ id: string }>(
      `insert into public.notification_queue
         (correlation_id, booking_id, type, channel, payload, status, attempt_count)
       values ($1, $2, 'client_confirmation', 'whatsapp', '{}'::jsonb, 'dead_letter', 5)
       returning id`,
      [correlationId, bookingId],
    );

    const res = await retryNotification(notifId, { performedBy: randomUUID(), reason: "operator retry" });
    expect(res.notificationId).toBe(notifId);

    const actions = await recoveryActions(notifId);
    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ action_type: "retry_notification", target_type: "notification_queue" });

    const { rows } = await pool.query<{ status: string; attempt_count: number }>(
      `select status, attempt_count from public.notification_queue where id = $1`,
      [notifId],
    );
    expect(rows[0].status).toBe("pending");
    expect(rows[0].attempt_count).toBe(0); // fresh retry budget
  });

  it("(7) recovery actions never directly mutate bookings / locks / orders", async () => {
    const s = await seedConfirmedFlow();
    // a notification to retry
    const { rows: [{ id: notifId }] } = await pool.query<{ id: string }>(
      `select id from public.notification_queue where booking_id = $1 limit 1`,
      [s.bookingId],
    );

    const before = await truthSnapshot();
    await replayEvent(s.eventId);
    await retryReconciliation(s.paymentOrderId, { provider: fakeProvider("paid") });
    await retryNotification(notifId);
    const after = await truthSnapshot();

    expect(after).toEqual(before); // only work/audit lanes changed
  });
});

describe("health & dashboard — read-only", () => {
  it("health funnel/backlog/lag reflect a confirmed flow", async () => {
    await seedConfirmedFlow();
    const health = await getPaymentHealth();

    expect(health.funnel).toEqual({
      bookingsStarted: 1,
      ordersCreated: 1,
      paymentsCaptured: 1,
      bookingsConfirmed: 1,
      notificationsQueued: 2,
      notificationsSent: 0,
    });
    expect(health.backlog).toEqual({
      unprocessedEvents: 0,
      pendingReconciliation: 0,
      pendingNotifications: 2,
      deadLetterNotifications: 0,
    });
    expect(health.lag.oldestUnprocessedEventSeconds).toBeNull();
    expect(health.lag.oldestPendingReconciliationSeconds).toBeNull();
    expect(health.lag.oldestPendingNotificationSeconds).toBeGreaterThanOrEqual(0);
  });

  it("(8) dashboard + health + integrity are read-only", async () => {
    await seedConfirmedFlow();
    const before = await truthSnapshot();
    await getPaymentHealth();
    await runIntegrityChecks();
    const data = await getDashboardData();
    const after = await truthSnapshot();

    expect(after).toEqual(before);
    // shape sanity
    expect(data.funnel.bookingsConfirmed).toBe(1);
    expect(data.integrity.passed).toBe(true);
    expect(data.notifications.pending).toBe(2);
    expect(data.reconciliation.pending).toBe(0);
  });
});
