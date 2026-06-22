import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { withTransaction } from "@/lib/db/pool";
import {
  applyBillingEvent,
  claimNextBilling,
  processPendingBillingEvents,
  reconcileBillingExpiries,
  type ClaimableBillingEvent,
} from "@/lib/billing/processor";
import { applySchema, makePool, seedCreator } from "../db/helpers";

/**
 * Billing Processor against real Postgres (no mocks). The processor is the sole
 * writer of subscription truth: it consumes billing_events and applies
 * state-guarded transitions to subscriptions + profiles.plan, one transaction
 * per event, with rollback-on-failure and replay/out-of-order safety. The
 * reconciliation sweep downgrades subscriptions whose paid period has lapsed.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

/** Seed a creator + a 'pending' subscription; returns ids. */
async function seedSub(opts: { status?: string; currentPeriodEnd?: string } = {}) {
  const creator = await seedCreator(pool);
  const subId = `sub_${randomUUID().slice(0, 14)}`;
  await pool.query(
    `insert into public.subscriptions (creator_id, razorpay_subscription_id, status, current_period_end)
     values ($1, $2, $3, $4)`,
    [creator, subId, opts.status ?? "pending", opts.currentPeriodEnd ?? null],
  );
  return { creator, subId };
}

/** Insert a linked, unprocessed billing event; current_end is unix seconds. */
async function insertEvent(subId: string, eventType: string, currentEnd?: number): Promise<string> {
  const payload = {
    event: eventType,
    payload: { subscription: { entity: { id: subId, current_end: currentEnd ?? null } } },
  };
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.billing_events
       (event_source, event_type, provider_event_id, razorpay_subscription_id, payload)
     values ('webhook', $1, $2, $3, $4::jsonb)
     returning id`,
    [eventType, `evt_${randomUUID().slice(0, 12)}`, subId, JSON.stringify(payload)],
  );
  return rows[0].id;
}

async function sub(subId: string) {
  const { rows } = await pool.query<{
    plan: string;
    status: string;
    cancel_at_period_end: boolean;
    current_period_end: string | null;
  }>(
    `select plan, status, cancel_at_period_end, current_period_end
       from public.subscriptions where razorpay_subscription_id = $1`,
    [subId],
  );
  return rows[0];
}

async function profilePlan(creatorId: string): Promise<string> {
  const { rows } = await pool.query<{ plan: string }>(`select plan from public.profiles where id = $1`, [creatorId]);
  return rows[0].plan;
}

async function eventProcessed(id: string): Promise<boolean> {
  const { rows } = await pool.query<{ processed: boolean }>(`select processed from public.billing_events where id = $1`, [id]);
  return rows[0].processed;
}

describe("billing processor — activation & charge", () => {
  it("subscription.activated → pro/active and profiles.plan='pro'", async () => {
    const { creator, subId } = await seedSub();
    await insertEvent(subId, "subscription.activated", 1893456000);
    await processPendingBillingEvents();

    const s = await sub(subId);
    expect(s.plan).toBe("pro");
    expect(s.status).toBe("active");
    expect(await profilePlan(creator)).toBe("pro");
  });

  it("subscription.charged bumps current_period_end forward and keeps pro/active", async () => {
    const { subId } = await seedSub();
    await insertEvent(subId, "subscription.charged", 1893456000); // 2030-01-01
    await processPendingBillingEvents();
    const after = await sub(subId);
    expect(after.status).toBe("active");
    expect(after.plan).toBe("pro");
    expect(new Date(after.current_period_end as string).getTime()).toBe(1893456000 * 1000);
  });

  it("out-of-order charged events never regress current_period_end", async () => {
    const { subId } = await seedSub();
    await insertEvent(subId, "subscription.charged", 1893456000); // newer (2030)
    await processPendingBillingEvents();
    await insertEvent(subId, "subscription.charged", 1735689600); // older (2025) arrives late
    await processPendingBillingEvents();
    // still the newer period end — the stale event did not pull it back
    expect(new Date((await sub(subId)).current_period_end as string).getTime()).toBe(1893456000 * 1000);
  });
});

describe("billing processor — failure & cancellation", () => {
  it("payment.failed → past_due but KEEPS plan='pro' (dunning, not downgrade)", async () => {
    const { creator, subId } = await seedSub();
    await insertEvent(subId, "subscription.activated", 1893456000);
    await processPendingBillingEvents();
    await insertEvent(subId, "payment.failed");
    await processPendingBillingEvents();

    const s = await sub(subId);
    expect(s.status).toBe("past_due");
    expect(s.plan).toBe("pro");
    expect(await profilePlan(creator)).toBe("pro");
  });

  it("subscription.cancelled → cancelled + cancel_at_period_end, still plan='pro'", async () => {
    const { creator, subId } = await seedSub();
    await insertEvent(subId, "subscription.activated", 1893456000);
    await processPendingBillingEvents();
    await insertEvent(subId, "subscription.cancelled");
    await processPendingBillingEvents();

    const s = await sub(subId);
    expect(s.status).toBe("cancelled");
    expect(s.cancel_at_period_end).toBe(true);
    expect(s.plan).toBe("pro"); // kept until the period lapses
    expect(await profilePlan(creator)).toBe("pro");
  });

  it("unknown event → marked processed, no business change", async () => {
    const { creator, subId } = await seedSub();
    const id = await insertEvent(subId, "subscription.paused");
    await processPendingBillingEvents();
    expect(await eventProcessed(id)).toBe(true);
    const s = await sub(subId);
    expect(s.plan).toBe("free");
    expect(s.status).toBe("pending");
    expect(await profilePlan(creator)).toBe("free");
  });
});

describe("billing processor — reconciliation downgrade", () => {
  it("a cancelled creator keeps Pro until period_end, then reconciliation flips to free", async () => {
    const { creator, subId } = await seedSub();
    await insertEvent(subId, "subscription.activated", 1893456000);
    await processPendingBillingEvents();
    await insertEvent(subId, "subscription.cancelled");
    await processPendingBillingEvents();

    // period not yet lapsed (set far future) → sweep is a no-op, still pro
    await pool.query(
      `update public.subscriptions set current_period_end = now() + interval '10 days' where razorpay_subscription_id = $1`,
      [subId],
    );
    expect((await reconcileBillingExpiries()).expired).toBe(0);
    expect((await sub(subId)).plan).toBe("pro");
    expect(await profilePlan(creator)).toBe("pro");

    // period lapses → sweep downgrades to free/expired and syncs the profile
    await pool.query(
      `update public.subscriptions set current_period_end = now() - interval '1 minute' where razorpay_subscription_id = $1`,
      [subId],
    );
    expect((await reconcileBillingExpiries()).expired).toBe(1);
    const s = await sub(subId);
    expect(s.status).toBe("expired");
    expect(s.plan).toBe("free");
    expect(await profilePlan(creator)).toBe("free");
  });

  it("an active subscription whose renewal never charged is swept to free once lapsed", async () => {
    const { creator, subId } = await seedSub();
    await insertEvent(subId, "subscription.activated", 1893456000);
    await processPendingBillingEvents();
    await pool.query(
      `update public.subscriptions set current_period_end = now() - interval '1 day' where razorpay_subscription_id = $1`,
      [subId],
    );
    await reconcileBillingExpiries();
    expect((await sub(subId)).status).toBe("expired");
    expect(await profilePlan(creator)).toBe("free");
  });
});

describe("billing processor — durability", () => {
  it("crash mid-transaction rolls back; a retry then completes cleanly", async () => {
    const { creator, subId } = await seedSub();
    const eventId = await insertEvent(subId, "subscription.activated", 1893456000);

    const { rows } = await pool.query<ClaimableBillingEvent>(
      `select id, event_type, razorpay_subscription_id, payload from public.billing_events where id = $1`,
      [eventId],
    );
    await expect(
      withTransaction(async (c) => {
        await applyBillingEvent(c, rows[0]);
        throw new Error("simulated crash before commit");
      }),
    ).rejects.toThrow("simulated crash");

    // rollback: nothing moved, event still unprocessed
    expect(await eventProcessed(eventId)).toBe(false);
    expect((await sub(subId)).plan).toBe("free");
    expect(await profilePlan(creator)).toBe("free");

    // retry succeeds
    await processPendingBillingEvents();
    expect(await eventProcessed(eventId)).toBe(true);
    expect((await sub(subId)).plan).toBe("pro");
    expect(await profilePlan(creator)).toBe("pro");
  });

  it("two workers race the same event → claimed and processed exactly once", async () => {
    await processPendingBillingEvents(); // drain stragglers
    const { subId } = await seedSub();
    const eventId = await insertEvent(subId, "subscription.activated", 1893456000);

    const c1 = await pool.connect();
    const c2 = await pool.connect();
    try {
      await c1.query("begin");
      await c2.query("begin");
      const e1 = await claimNextBilling(c1);
      const e2 = await claimNextBilling(c2); // locked by c1 → SKIP LOCKED yields nothing
      expect(e1?.id).toBe(eventId);
      expect(e2).toBeNull();
      await applyBillingEvent(c1, e1 as ClaimableBillingEvent);
      await c1.query("commit");
      await c2.query("commit");
    } finally {
      c1.release();
      c2.release();
    }
    expect(await eventProcessed(eventId)).toBe(true);
    expect((await sub(subId)).plan).toBe("pro");
  });
});
