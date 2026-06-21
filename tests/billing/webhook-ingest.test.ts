import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { POST } from "@/app/api/webhooks/razorpay/route";
import { applySchema, makePool, seedCreator } from "../db/helpers";

/**
 * Billing webhook ingest, driven through the REAL single Razorpay route. Proves
 * the classifier (Decision A) routes subscription events to billing_events,
 * leaves the payments ledger path intact for booking orders, and persists
 * nothing for an unroutable event. The ingestor verifies, enriches read-only,
 * appends ONE immutable row, and performs no state transition.
 */

const SECRET = "whsec_test_billing";
let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
  process.env.RAZORPAY_WEBHOOK_SECRET = SECRET;
  delete process.env.PAYMENT_PROVIDER;
});

afterAll(async () => {
  await pool.end();
});

function sign(body: string): string {
  return createHmac("sha256", SECRET).update(body).digest("hex");
}

function post(body: string, headers: Record<string, string>): Promise<Response> {
  return POST(new Request("http://localhost/api/webhooks/razorpay", { method: "POST", body, headers }));
}

function subscriptionBody(subId: string, eventType = "subscription.charged", currentEnd?: number): string {
  return JSON.stringify({
    event: eventType,
    payload: {
      subscription: { entity: { id: subId, status: "active", current_end: currentEnd ?? 1893456000 } },
      payment: { entity: { id: `pay_${randomUUID().slice(0, 8)}`, order_id: `order_${randomUUID().slice(0, 8)}` } },
    },
  });
}

function bookingBody(orderId: string): string {
  return JSON.stringify({
    event: "payment.captured",
    payload: { payment: { entity: { id: `pay_${randomUUID().slice(0, 8)}`, order_id: orderId } } },
  });
}

async function seedSubscription(creatorId: string, subId: string): Promise<void> {
  await pool.query(
    `insert into public.subscriptions (creator_id, razorpay_subscription_id, status) values ($1, $2, 'pending')`,
    [creatorId, subId],
  );
}

async function billingRows(subId: string) {
  const { rows } = await pool.query<{ creator_id: string | null; event_type: string; event_source: string }>(
    `select creator_id, event_type, event_source from public.billing_events where razorpay_subscription_id = $1`,
    [subId],
  );
  return rows;
}

async function count(table: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(`select count(*)::text as n from public.${table}`);
  return Number(rows[0].n);
}

describe("billing webhook ingest — routing & persistence", () => {
  it("a subscription event lands in billing_events, enriched with creator_id", async () => {
    const creator = await seedCreator(pool);
    const subId = `sub_${randomUUID().slice(0, 12)}`;
    await seedSubscription(creator, subId);

    const body = subscriptionBody(subId);
    const res = await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": `evt_${randomUUID().slice(0, 8)}` });
    expect(res.status).toBe(200);
    expect((await res.json()).ledger).toBe("billing");

    const rows = await billingRows(subId);
    expect(rows).toHaveLength(1);
    expect(rows[0].creator_id).toBe(creator);
    expect(rows[0].event_source).toBe("webhook");
  });

  it("a subscription event for an unknown sub persists unlinked (creator_id NULL)", async () => {
    const subId = `sub_${randomUUID().slice(0, 12)}`; // never seeded
    const body = subscriptionBody(subId, "subscription.activated");
    const res = await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": `evt_${randomUUID().slice(0, 8)}` });
    expect(res.status).toBe(200);
    const rows = await billingRows(subId);
    expect(rows).toHaveLength(1);
    expect(rows[0].creator_id).toBeNull();
  });

  it("invalid signature → 400, nothing persisted to billing_events", async () => {
    const before = await count("billing_events");
    const subId = `sub_${randomUUID().slice(0, 12)}`;
    const body = subscriptionBody(subId);
    const res = await post(body, { "x-razorpay-signature": "deadbeef", "x-razorpay-event-id": "evt_bad" });
    expect(res.status).toBe(400);
    expect(await count("billing_events")).toBe(before);
  });

  it("duplicate delivery (same event id) collapses → one row, both 200", async () => {
    const creator = await seedCreator(pool);
    const subId = `sub_${randomUUID().slice(0, 12)}`;
    await seedSubscription(creator, subId);
    const body = subscriptionBody(subId);
    const headers = { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_billing_dup" };
    const a = await post(body, headers);
    const b = await post(body, headers);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect((await b.json()).status).toBe("duplicate");
    expect(await billingRows(subId)).toHaveLength(1);
  });
});

describe("billing webhook ingest — ledger isolation", () => {
  it("a booking order event does NOT touch billing_events (routes to payments)", async () => {
    const beforeBilling = await count("billing_events");
    const beforePayments = await count("payment_events");
    const orderId = `order_${randomUUID().replace(/-/g, "").slice(0, 14)}`;
    const body = bookingBody(orderId);
    const res = await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": `evt_${randomUUID().slice(0, 8)}` });
    expect(res.status).toBe(200);
    // payments ledger grew; billing ledger untouched
    expect(await count("payment_events")).toBe(beforePayments + 1);
    expect(await count("billing_events")).toBe(beforeBilling);
  });

  it("an unroutable event (neither id) persists to NEITHER ledger, acks 200", async () => {
    const beforeBilling = await count("billing_events");
    const beforePayments = await count("payment_events");
    const body = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: "pay_orphan" } } } });
    const res = await post(body, { "x-razorpay-signature": sign(body), "x-razorpay-event-id": "evt_orphan" });
    expect(res.status).toBe(200);
    expect((await res.json()).ledger).toBe("none");
    expect(await count("billing_events")).toBe(beforeBilling);
    expect(await count("payment_events")).toBe(beforePayments);
  });
});
