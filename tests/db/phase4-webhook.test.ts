import { createHmac, createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { POST } from "@/app/api/webhooks/razorpay/route";
import { applySchema, makePool, seedBooking, seedCreator, uniqueSlot } from "./helpers";

/**
 * Phase 4 — Webhook Ingestor against real Postgres (no mocks).
 *
 * The ingestor verifies the signature, enriches the event from a READ-ONLY
 * payment_orders lookup, persists ONE immutable payment_events row, and acks.
 * It writes no other table and performs no state transition. These tests drive
 * the real route handler (thin HTTP adapter) end-to-end.
 */

const SECRET = "whsec_test_phase4";
let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  delete process.env.PAYMENT_PROVIDER; // test mode
});

afterAll(async () => {
  await pool.end();
});

afterEach(() => {
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
});

function sign(body: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

function webhookBody(orderId: string, eventType = "payment.captured"): string {
  return JSON.stringify({
    event: eventType,
    payload: { payment: { entity: { id: `pay_${randomUUID().slice(0, 8)}`, order_id: orderId, notes: {} } } },
  });
}

function post(body: string, headers: Record<string, string>): Promise<Response> {
  return POST(
    new Request("http://localhost/api/webhooks/razorpay", { method: "POST", body, headers }),
  );
}

/** Seed booking + payment_orders; return the provider order id and its linkage. */
async function seedOrder(creator: string): Promise<{ orderId: string; correlationId: string; paymentOrderId: string }> {
  const correlationId = randomUUID();
  const slot = uniqueSlot();
  const bookingId = await seedBooking(pool, { creatorId: creator, slotStart: slot.start, slotEnd: slot.end, correlationId });
  const orderId = `order_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.payment_orders
       (correlation_id, booking_id, provider, provider_order_id, amount_paise, currency, status)
     values ($1, $2, 'razorpay_test', $3, 149900, 'INR', 'created')
     returning id`,
    [correlationId, bookingId, orderId],
  );
  return { orderId, correlationId, paymentOrderId: rows[0].id };
}

async function eventsForOrderId(orderId: string): Promise<Array<{ correlation_id: string; payment_order_id: string | null; provider_event_id: string; event_source: string }>> {
  const { rows } = await pool.query(
    `select correlation_id, payment_order_id, provider_event_id, event_source
       from public.payment_events
      where payload->'payload'->'payment'->'entity'->>'order_id' = $1`,
    [orderId],
  );
  return rows;
}

async function count(table: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`select count(*)::text as n from public.${table}`);
  return Number(rows[0].n);
}

describe("webhook ingest — signature gate", () => {
  it("(3) invalid signature → 400, nothing persisted", async () => {
    const before = await count("payment_events");
    const { orderId } = await seedOrder(await seedCreator(pool));
    const body = webhookBody(orderId);
    const res = await post(body, { "x-razorpay-signature": "deadbeef", "x-razorpay-event-id": "evt_bad" });
    expect(res.status).toBe(400);
    expect(await count("payment_events")).toBe(before);
  });

  it("(4) missing secret → 400, nothing persisted", async () => {
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    const before = await count("payment_events");
    const { orderId } = await seedOrder(await seedCreator(pool));
    const body = webhookBody(orderId);
    const res = await post(body, { "x-razorpay-signature": sign(body, SECRET), "x-razorpay-event-id": "evt_nosecret" });
    expect(res.status).toBe(400);
    expect(await count("payment_events")).toBe(before);
  });
});

describe("webhook ingest — persistence & enrichment", () => {
  it("(1)(5) valid webhook with matching order → one linked row", async () => {
    const { orderId, correlationId, paymentOrderId } = await seedOrder(await seedCreator(pool));
    const body = webhookBody(orderId);
    const res = await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_ok_1" });
    expect(res.status).toBe(200);

    const rows = await eventsForOrderId(orderId);
    expect(rows).toHaveLength(1);
    expect(rows[0].payment_order_id).toBe(paymentOrderId);
    expect(rows[0].correlation_id).toBe(correlationId);
    expect(rows[0].event_source).toBe("webhook");
  });

  it("(6) valid webhook, no matching order → inserted unlinked (payment_order_id NULL)", async () => {
    const orderId = `order_${randomUUID().replace(/-/g, "").slice(0, 14)}`; // never seeded
    const body = webhookBody(orderId);
    const res = await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_unlinked" });
    expect(res.status).toBe(200);

    const rows = await eventsForOrderId(orderId);
    expect(rows).toHaveLength(1);
    expect(rows[0].payment_order_id).toBeNull();
    // provider_order_id stays recoverable from the payload
    expect(rows[0].correlation_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("(2) duplicate delivery (same event id) → one row total, both 200", async () => {
    const { orderId } = await seedOrder(await seedCreator(pool));
    const body = webhookBody(orderId);
    const headers = { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_dup" };
    const a = await post(body, headers);
    const b = await post(body, headers);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(await eventsForOrderId(orderId)).toHaveLength(1);
  });

  it("(7) absent event-id header → provider_event_id falls back to sha256(raw_body)", async () => {
    const { orderId } = await seedOrder(await seedCreator(pool));
    const body = webhookBody(orderId);
    const res = await post(body, { "x-razorpay-signature": sign(body) });
    expect(res.status).toBe(200);

    const expected = createHash("sha256").update(body).digest("hex");
    const rows = await eventsForOrderId(orderId);
    expect(rows).toHaveLength(1);
    expect(rows[0].provider_event_id).toBe(expected);
  });
});

describe("webhook ingest — no side effects", () => {
  it("(8) only payment_events changes; business tables untouched", async () => {
    const { orderId } = await seedOrder(await seedCreator(pool));
    const before = {
      bookings: await count("bookings"),
      booking_locks: await count("booking_locks"),
      payment_orders: await count("payment_orders"),
      notification_queue: await count("notification_queue"),
      payment_events: await count("payment_events"),
    };
    const body = webhookBody(orderId);
    const res = await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_sidefx" });
    expect(res.status).toBe(200);

    expect(await count("bookings")).toBe(before.bookings);
    expect(await count("booking_locks")).toBe(before.booking_locks);
    expect(await count("payment_orders")).toBe(before.payment_orders);
    expect(await count("notification_queue")).toBe(before.notification_queue);
    expect(await count("payment_events")).toBe(before.payment_events + 1);
  });
});

describe("webhook ingest — route is a thin adapter", () => {
  it("(9) route.ts contains no SQL and no database access", () => {
    const src = readFileSync(resolve(process.cwd(), "src/app/api/webhooks/razorpay/route.ts"), "utf8");
    expect(src).not.toMatch(/\b(insert|update|delete|select)\b/i);
    expect(src).not.toMatch(/getPool|from\s+["']pg["']|withTransaction/);
  });
});
