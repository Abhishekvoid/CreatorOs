import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { initiate, processPendingEvents } from "@/lib/payments";
import { reconcileSweep } from "@/lib/payments/reconcile";
import type { PaymentProvider } from "@/lib/payments";
import { applySchema, makePool, seedCreator, uniqueSlot } from "./helpers";

/**
 * Phase 6 — Reconciliation Sweep against real Postgres (no mocks).
 *
 * The sweep asks the provider what really happened to a pending_reconciliation
 * lock's order and emits a deterministic reconciliation event into
 * payment_events. It writes no business truth — the Phase 5 processor consumes
 * the event and performs the confirm/release. Provider responses are supplied
 * via an injected PaymentProvider double.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
  delete process.env.PAYMENT_PROVIDER; // test mode → synthetic order, no network
});

afterAll(async () => {
  await pool.end();
});

afterEach(async () => {
  // neutralise any lingering reconciliation target so each test's global sweep
  // counts reflect only its own freshly-seeded order.
  await pool.query(`update public.payment_orders set status = 'captured' where status in ('created', 'pending')`);
});

/** Provider double: canned order/payment status, every other method unused. */
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

/** Booking + lock(pending_reconciliation) + order(created) — a sweep target. */
async function seedReconcilable(opts: { providerPaymentId?: string } = {}): Promise<{
  bookingId: string;
  paymentOrderId: string;
  correlationId: string;
  providerOrderId: string;
}> {
  const creator = await seedCreator(pool);
  const slot = uniqueSlot();
  const out = await initiate({ creatorId: creator, slotStart: slot.start, slotEnd: slot.end, amountPaise: 149900 });
  await pool.query(`update public.booking_locks set status = 'pending_reconciliation' where booking_id = $1`, [out.bookingId]);
  if (opts.providerPaymentId) {
    await pool.query(`update public.payment_orders set provider_payment_id = $2 where id = $1`, [out.paymentOrderId, opts.providerPaymentId]);
  }
  return { bookingId: out.bookingId, paymentOrderId: out.paymentOrderId, correlationId: out.correlationId, providerOrderId: out.orderId };
}

async function bookingStatus(id: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(`select status from public.bookings where id = $1`, [id]);
  return rows[0].status;
}
async function lockStatusOf(bookingId: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(`select status from public.booking_locks where booking_id = $1`, [bookingId]);
  return rows[0].status;
}
async function orderStatus(id: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(`select status from public.payment_orders where id = $1`, [id]);
  return rows[0].status;
}
async function events(paymentOrderId: string): Promise<Array<{ provider_event_id: string; event_type: string; event_source: string; correlation_id: string }>> {
  const { rows } = await pool.query(
    `select provider_event_id, event_type, event_source, correlation_id
       from public.payment_events where payment_order_id = $1 order by created_at`,
    [paymentOrderId],
  );
  return rows;
}
async function count(table: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`select count(*)::text as n from public.${table}`);
  return Number(rows[0].n);
}

describe("reconcile — recovery paths", () => {
  it("(1) missing-webhook recovery: captured → event → processor confirms", async () => {
    const s = await seedReconcilable();
    const counts = await reconcileSweep({ provider: fakeProvider("paid") });
    expect(counts).toMatchObject({ examined: 1, captured: 1, failed: 0, skipped: 0, duplicates: 0 });

    const evs = await events(s.paymentOrderId);
    expect(evs).toHaveLength(1);
    expect(evs[0].event_source).toBe("reconciliation");
    expect(evs[0].event_type).toBe("reconciliation.captured");
    expect(evs[0].provider_event_id).toBe(`recon:${s.providerOrderId}:captured`);
    expect(evs[0].correlation_id).toBe(s.correlationId);

    await processPendingEvents();
    expect(await bookingStatus(s.bookingId)).toBe("confirmed");
    expect(await lockStatusOf(s.bookingId)).toBe("confirmed");
    expect(await orderStatus(s.paymentOrderId)).toBe("captured");
  });

  it("(2) verified failure: failed → event → processor releases lock & cancels booking", async () => {
    // provider_payment_id present so the sweep consults getPaymentStatus too
    const s = await seedReconcilable({ providerPaymentId: "pay_recon_fail" });
    const counts = await reconcileSweep({ provider: fakeProvider("attempted", "failed") });
    expect(counts).toMatchObject({ examined: 1, captured: 0, failed: 1 });

    const evs = await events(s.paymentOrderId);
    expect(evs).toHaveLength(1);
    expect(evs[0].event_type).toBe("reconciliation.failed");
    expect(evs[0].provider_event_id).toBe(`recon:${s.providerOrderId}:failed`);

    await processPendingEvents();
    expect(await lockStatusOf(s.bookingId)).toBe("released");
    expect(await bookingStatus(s.bookingId)).toBe("cancelled");
    expect(await orderStatus(s.paymentOrderId)).toBe("failed");
  });

  it("(7) EXPIRED maps to reconciliation.failed", async () => {
    const s = await seedReconcilable();
    const counts = await reconcileSweep({ provider: fakeProvider("expired") });
    expect(counts).toMatchObject({ examined: 1, failed: 1 });
    const evs = await events(s.paymentOrderId);
    expect(evs[0].event_type).toBe("reconciliation.failed");
    expect(evs[0].provider_event_id).toBe(`recon:${s.providerOrderId}:failed`);
  });
});

describe("reconcile — determinism & safety", () => {
  it("(3)(6) overlapping/repeated sweeps emit exactly one event", async () => {
    const s = await seedReconcilable();
    const a = await reconcileSweep({ provider: fakeProvider("paid") });
    const b = await reconcileSweep({ provider: fakeProvider("paid") });
    const c = await reconcileSweep({ provider: fakeProvider("paid") });
    expect(a).toMatchObject({ captured: 1, duplicates: 0 });
    expect(b).toMatchObject({ captured: 0, duplicates: 1 });
    expect(c).toMatchObject({ captured: 0, duplicates: 1 });
    expect(await events(s.paymentOrderId)).toHaveLength(1);
  });

  it("(4) unknown provider state → no event, order stays unresolved", async () => {
    const s = await seedReconcilable();
    const counts = await reconcileSweep({ provider: fakeProvider("attempted") });
    expect(counts).toMatchObject({ examined: 1, captured: 0, failed: 0, skipped: 1, duplicates: 0 });
    expect(await events(s.paymentOrderId)).toHaveLength(0);
    expect(await orderStatus(s.paymentOrderId)).toBe("created");
    expect(await lockStatusOf(s.bookingId)).toBe("pending_reconciliation");
  });

  it("(5) sweep writes no business truth — only payment_events changes", async () => {
    const s = await seedReconcilable();
    const before = {
      bookings: await count("bookings"),
      booking_locks: await count("booking_locks"),
      payment_orders: await count("payment_orders"),
      notification_queue: await count("notification_queue"),
      payment_events: await count("payment_events"),
    };
    await reconcileSweep({ provider: fakeProvider("paid") });

    expect(await count("bookings")).toBe(before.bookings);
    expect(await count("booking_locks")).toBe(before.booking_locks);
    expect(await count("payment_orders")).toBe(before.payment_orders);
    expect(await count("notification_queue")).toBe(before.notification_queue);
    expect(await count("payment_events")).toBe(before.payment_events + 1);
    // and no status moved
    expect(await bookingStatus(s.bookingId)).toBe("payment_pending");
    expect(await lockStatusOf(s.bookingId)).toBe("pending_reconciliation");
    expect(await orderStatus(s.paymentOrderId)).toBe("created");
  });
});
