import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import type { BillingProvider } from "@/lib/billing/provider";
import { cancelPro, startProUpgrade } from "@/lib/billing/subscribe";
import { processPendingBillingEvents, reconcileBillingExpiries } from "@/lib/billing/processor";
import { applySchema, makePool, seedCreator } from "../db/helpers";

/**
 * Subscription lifecycle: the upgrade idempotency guard (Decision D, money
 * safety) and the V1 happy path pending → active → expired end to end (upgrade
 * action writes pending; the processor — driven by webhook events — owns every
 * transition; the sweep downgrades once the period lapses).
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

/** A fake provider that counts createSubscription calls (Decision D proof). */
function countingProvider() {
  let creates = 0;
  let cancels = 0;
  const provider: BillingProvider = {
    getProviderName: () => "fake",
    async createSubscription({ creatorId }) {
      creates++;
      return {
        subscriptionId: `sub_fake_${creates}_${creatorId.slice(0, 6)}`,
        status: "created",
        shortUrl: "https://rzp.test/checkout",
        currentPeriodEnd: null,
      };
    },
    async cancelSubscription({ subscriptionId }) {
      cancels++;
      return { subscriptionId, status: "active", shortUrl: null, currentPeriodEnd: null };
    },
    async getSubscription(subscriptionId) {
      return { subscriptionId, status: "active", shortUrl: null, currentPeriodEnd: null };
    },
  };
  return { provider, creates: () => creates, cancels: () => cancels };
}

async function insertEvent(subId: string, eventType: string, currentEnd?: number): Promise<void> {
  const payload = { event: eventType, payload: { subscription: { entity: { id: subId, current_end: currentEnd ?? null } } } };
  await pool.query(
    `insert into public.billing_events (event_source, event_type, provider_event_id, razorpay_subscription_id, payload)
     values ('webhook', $1, $2, $3, $4::jsonb)`,
    [eventType, `evt_${randomUUID().slice(0, 12)}`, subId, JSON.stringify(payload)],
  );
}

async function sub(creatorId: string) {
  const { rows } = await pool.query<{
    plan: string;
    status: string;
    razorpay_subscription_id: string | null;
    current_period_end: string | null;
  }>(
    `select plan, status, razorpay_subscription_id, current_period_end
       from public.subscriptions where creator_id = $1`,
    [creatorId],
  );
  return rows[0];
}

async function profilePlan(creatorId: string): Promise<string> {
  const { rows } = await pool.query<{ plan: string }>(`select plan from public.profiles where id = $1`, [creatorId]);
  return rows[0].plan;
}

async function subCount(creatorId: string): Promise<number> {
  const { rows } = await pool.query<{ n: string }>(
    `select count(*)::text as n from public.subscriptions where creator_id = $1`,
    [creatorId],
  );
  return Number(rows[0].n);
}

describe("Decision D — idempotent upgrade", () => {
  it("two upgrade calls produce exactly one Razorpay subscription", async () => {
    const creator = await seedCreator(pool);
    const p = countingProvider();

    const first = await startProUpgrade(creator, { provider: p.provider });
    const second = await startProUpgrade(creator, { provider: p.provider });

    expect(p.creates()).toBe(1); // the guard short-circuited the second call
    expect(first.status).toBe("created");
    expect(second.status).toBe("existing");
    expect(second.subscriptionId).toBe(first.subscriptionId);
    expect(await subCount(creator)).toBe(1);
    expect((await sub(creator)).status).toBe("pending"); // not Pro until activated
    expect(await profilePlan(creator)).toBe("free");
  });

  it("short-circuits when already active (no second Razorpay subscription)", async () => {
    const creator = await seedCreator(pool);
    const p = countingProvider();
    const { subscriptionId } = await startProUpgrade(creator, { provider: p.provider });
    await insertEvent(subscriptionId, "subscription.activated", 1893456000);
    await processPendingBillingEvents();
    expect((await sub(creator)).status).toBe("active");

    const again = await startProUpgrade(creator, { provider: p.provider });
    expect(p.creates()).toBe(1);
    expect(again.status).toBe("existing");
  });
});

describe("V1 happy path — pending → active → expired", () => {
  it("upgrade → activated → active(pro) → charged stays active → lapse → free", async () => {
    const creator = await seedCreator(pool);
    const p = countingProvider();

    // 1. upgrade: pending row, plan still free (entitlement not yet granted)
    const { subscriptionId } = await startProUpgrade(creator, { provider: p.provider });
    expect((await sub(creator)).status).toBe("pending");
    expect(await profilePlan(creator)).toBe("free");

    // 2. activated webhook → processor flips to active + pro, profile synced
    await insertEvent(subscriptionId, "subscription.activated", 1893456000); // 2030-01-01
    await processPendingBillingEvents();
    let s = await sub(creator);
    expect(s.status).toBe("active");
    expect(s.plan).toBe("pro");
    expect(await profilePlan(creator)).toBe("pro");

    // 3. renewal charge → still active, period bumped forward
    await insertEvent(subscriptionId, "subscription.charged", 1924992000); // 2031-01-01
    await processPendingBillingEvents();
    s = await sub(creator);
    expect(s.status).toBe("active");
    expect(new Date(s.current_period_end as string).getTime()).toBe(1924992000 * 1000);

    // 4. period lapses (renewal stopped) → daily sweep downgrades to free
    await pool.query(
      `update public.subscriptions set current_period_end = now() - interval '1 minute' where creator_id = $1`,
      [creator],
    );
    expect((await reconcileBillingExpiries()).expired).toBe(1);
    s = await sub(creator);
    expect(s.status).toBe("expired");
    expect(s.plan).toBe("free");
    expect(await profilePlan(creator)).toBe("free");
  });

  it("cancel on an active subscription calls the provider once; sweep still owns downgrade", async () => {
    const creator = await seedCreator(pool);
    const p = countingProvider();
    const { subscriptionId } = await startProUpgrade(creator, { provider: p.provider });
    await insertEvent(subscriptionId, "subscription.activated", 1893456000);
    await processPendingBillingEvents();

    const res = await cancelPro(creator, { provider: p.provider });
    expect(res.status).toBe("requested");
    expect(p.cancels()).toBe(1);

    const noop = await cancelPro(await seedCreator(pool), { provider: p.provider });
    expect(noop.status).toBe("noop"); // never upgraded → nothing to cancel
  });
});
