import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { initiate } from "@/lib/payments";
import { processPendingEvents, applyEvent, claimNext, type ClaimableEvent } from "@/lib/payments/processor";
import { withTransaction } from "@/lib/db/pool";
import { applySchema, makePool, seedCreator, uniqueSlot } from "./helpers";

/**
 * Phase 5 — Payment Processor Worker against real Postgres (no mocks).
 *
 * The processor is the sole writer of business truth: it consumes payment_events
 * and applies state-guarded transitions to payment_orders / bookings /
 * booking_locks plus queued notifications, one transaction per event, with
 * rollback-on-failure and replay/out-of-order safety.
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

/** Seed a fully-linked, unprocessed event over a real booking+lock+order. */
async function seedEvent(opts: {
  eventType: string;
  eventSource?: string;
  providerEventId?: string;
}): Promise<{ creator: string; bookingId: string; paymentOrderId: string; correlationId: string; eventId: string }> {
  const creator = await seedCreator(pool);
  const slot = uniqueSlot();
  const out = await initiate({ creatorId: creator, slotStart: slot.start, slotEnd: slot.end, amountPaise: 149900 });
  const eventId = await insertEvent({
    correlationId: out.correlationId,
    paymentOrderId: out.paymentOrderId,
    eventType: opts.eventType,
    eventSource: opts.eventSource ?? "webhook",
    providerEventId: opts.providerEventId,
  });
  return { creator, bookingId: out.bookingId, paymentOrderId: out.paymentOrderId, correlationId: out.correlationId, eventId };
}

async function insertEvent(opts: {
  correlationId: string;
  paymentOrderId: string;
  eventType: string;
  eventSource?: string;
  providerEventId?: string;
}): Promise<string> {
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.payment_events
       (correlation_id, event_source, event_type, provider_event_id, payment_order_id, payload)
     values ($1, $2, $3, $4, $5, '{}'::jsonb)
     returning id`,
    [opts.correlationId, opts.eventSource ?? "webhook", opts.eventType, opts.providerEventId ?? `evt_${randomUUID().slice(0, 12)}`, opts.paymentOrderId],
  );
  return rows[0].id;
}

async function bookingStatus(id: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(`select status from public.bookings where id = $1`, [id]);
  return rows[0].status;
}
async function lockStatusOf(bookingId: string): Promise<string> {
  const { rows } = await pool.query<{ status: string }>(`select status from public.booking_locks where booking_id = $1`, [bookingId]);
  return rows[0].status;
}
async function orderRow(id: string): Promise<{ status: string; caused_by_event_id: string | null; captured_at: string | null; failed_at: string | null }> {
  const { rows } = await pool.query(`select status, caused_by_event_id, captured_at, failed_at from public.payment_orders where id = $1`, [id]);
  return rows[0];
}
async function eventRow(id: string): Promise<{ processed: boolean; processed_at: string | null }> {
  const { rows } = await pool.query(`select processed, processed_at from public.payment_events where id = $1`, [id]);
  return rows[0];
}
async function loadClaimable(id: string): Promise<ClaimableEvent> {
  const { rows } = await pool.query<ClaimableEvent>(
    `select id, event_source, event_type, payment_order_id, correlation_id from public.payment_events where id = $1`,
    [id],
  );
  return rows[0];
}
async function notifs(bookingId: string): Promise<Array<{ type: string; channel: string; status: string; sent_at: string | null }>> {
  const { rows } = await pool.query(`select type, channel, status, sent_at from public.notification_queue where booking_id = $1 order by type`, [bookingId]);
  return rows;
}

describe("processor — captured flow", () => {
  it("(1) PAYMENT_CAPTURED → booking confirmed, lock confirmed, order captured, event processed", async () => {
    const s = await seedEvent({ eventType: "payment.captured" });
    await processPendingEvents();

    expect(await bookingStatus(s.bookingId)).toBe("confirmed");
    expect(await lockStatusOf(s.bookingId)).toBe("confirmed");
    const o = await orderRow(s.paymentOrderId);
    expect(o.status).toBe("captured");
    expect(o.caused_by_event_id).toBe(s.eventId);
    expect(o.captured_at).not.toBeNull();
    expect((await eventRow(s.eventId)).processed).toBe(true);
  });

  it("order.paid is treated as a capture", async () => {
    const s = await seedEvent({ eventType: "order.paid" });
    await processPendingEvents();
    expect(await bookingStatus(s.bookingId)).toBe("confirmed");
    expect((await orderRow(s.paymentOrderId)).status).toBe("captured");
  });

  it("(8) inserts a notification pair, nothing sent", async () => {
    const s = await seedEvent({ eventType: "payment.captured" });
    await processPendingEvents();
    const n = await notifs(s.bookingId);
    expect(n.map((r) => r.type)).toEqual(["client_confirmation", "creator_confirmation"]);
    expect(n.every((r) => r.status === "pending" && r.sent_at === null)).toBe(true);
  });
});

describe("processor — failed flow", () => {
  it("(2) PAYMENT_FAILED → booking cancelled, lock released, order failed, event processed", async () => {
    const s = await seedEvent({ eventType: "payment.failed" });
    await processPendingEvents();

    expect(await bookingStatus(s.bookingId)).toBe("cancelled");
    expect(await lockStatusOf(s.bookingId)).toBe("released");
    const o = await orderRow(s.paymentOrderId);
    expect(o.status).toBe("failed");
    expect(o.failed_at).not.toBeNull();
    expect((await eventRow(s.eventId)).processed).toBe(true);

    const n = await notifs(s.bookingId);
    expect(n.map((r) => r.type)).toEqual(["client_cancellation", "creator_cancellation"]);
  });
});

describe("processor — idempotency & ordering", () => {
  it("(3) replaying PAYMENT_CAPTURED three times → one confirmation pair", async () => {
    const s = await seedEvent({ eventType: "payment.captured" });
    for (let i = 0; i < 3; i++) {
      await processPendingEvents();
      // reset to force a genuine re-application of the same event
      await pool.query(`update public.payment_events set processed = false, processed_at = null where id = $1`, [s.eventId]);
    }
    await processPendingEvents(); // final settle

    expect(await bookingStatus(s.bookingId)).toBe("confirmed");
    expect(await lockStatusOf(s.bookingId)).toBe("confirmed");
    expect((await notifs(s.bookingId)).length).toBe(2);
  });

  it("(4) FAILED after CAPTURED → no downgrade, no cancellation notifications", async () => {
    const s = await seedEvent({ eventType: "payment.captured" });
    await processPendingEvents();
    await insertEvent({ correlationId: s.correlationId, paymentOrderId: s.paymentOrderId, eventType: "payment.failed" });
    await processPendingEvents();

    expect(await bookingStatus(s.bookingId)).toBe("confirmed");
    expect(await lockStatusOf(s.bookingId)).toBe("confirmed");
    expect((await orderRow(s.paymentOrderId)).status).toBe("captured");
    const types = (await notifs(s.bookingId)).map((r) => r.type);
    expect(types).toEqual(["client_confirmation", "creator_confirmation"]);
  });

  it("(7) unknown event → processed, no business change", async () => {
    const s = await seedEvent({ eventType: "payment.authorized" });
    await processPendingEvents();
    expect((await eventRow(s.eventId)).processed).toBe(true);
    expect(await bookingStatus(s.bookingId)).toBe("payment_pending");
    expect(await lockStatusOf(s.bookingId)).toBe("active");
    expect((await orderRow(s.paymentOrderId)).status).toBe("created");
    expect((await notifs(s.bookingId)).length).toBe(0);
  });
});

describe("processor — durability & concurrency", () => {
  it("(5) crash mid-transaction → full rollback, then a retry succeeds", async () => {
    const s = await seedEvent({ eventType: "payment.captured" });
    const event = await loadClaimable(s.eventId);

    // crash after the transitions are staged but before commit
    await expect(
      withTransaction(async (c) => {
        await applyEvent(c, event);
        throw new Error("simulated crash before commit");
      }),
    ).rejects.toThrow("simulated crash");

    // rollback: nothing moved, the event is still unprocessed (and re-claimable)
    expect((await eventRow(s.eventId)).processed).toBe(false);
    expect(await bookingStatus(s.bookingId)).toBe("payment_pending");
    expect(await lockStatusOf(s.bookingId)).toBe("active");
    expect((await orderRow(s.paymentOrderId)).status).toBe("created");
    expect((await notifs(s.bookingId)).length).toBe(0);

    // retry: the worker re-claims the same event and completes it cleanly
    await processPendingEvents();
    expect((await eventRow(s.eventId)).processed).toBe(true);
    expect(await bookingStatus(s.bookingId)).toBe("confirmed");
    expect(await lockStatusOf(s.bookingId)).toBe("confirmed");
    expect((await orderRow(s.paymentOrderId)).status).toBe("captured");
    expect((await notifs(s.bookingId)).length).toBe(2);
  });

  it("(6) two workers race the same event → claimed and processed exactly once", async () => {
    await processPendingEvents(); // drain any stragglers first
    const s = await seedEvent({ eventType: "payment.captured" });

    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      await c1.query("begin");
      await c2.query("begin");
      const e1 = await claimNext(c1);
      const e2 = await claimNext(c2); // row is locked by c1 → SKIP LOCKED yields nothing
      expect(e1?.id).toBe(s.eventId);
      expect(e2).toBeNull();
      await applyEvent(c1, e1 as ClaimableEvent);
      await c1.query("commit");
      await c2.query("commit");
    } finally {
      c1.release();
      c2.release();
    }

    expect((await eventRow(s.eventId)).processed).toBe(true);
    expect(await bookingStatus(s.bookingId)).toBe("confirmed");
    expect((await notifs(s.bookingId)).length).toBe(2);
  });
});
