import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { applySchema, makePool, pgErrorCode, seedCreator } from "./helpers";

/**
 * Part 10 — Billing & Subscriptions schema invariants.
 *
 * Mirrors the frozen payments architecture on its own tables: subscriptions is
 * the source of truth (one per creator, service-role write / owner read), and
 * billing_events is an append-only, immutable ledger. We pin the constraints,
 * the immutability guard, RLS, and the profiles.plan denormalization here so the
 * processor and enforcement layers can rely on them.
 */

let pool: Pool;

beforeAll(async () => {
  pool = makePool();
  await applySchema(pool);
});

afterAll(async () => {
  await pool.end();
});

async function insertSubscription(creatorId: string, fields: Record<string, unknown> = {}): Promise<string> {
  const cols = ["creator_id", ...Object.keys(fields)];
  const vals = [creatorId, ...Object.values(fields)];
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.subscriptions (${cols.join(", ")}) values (${placeholders}) returning id`,
    vals,
  );
  return rows[0].id;
}

async function insertBillingEvent(fields: Record<string, unknown> = {}): Promise<string> {
  const base = {
    event_source: "webhook",
    event_type: "subscription.activated",
    provider_event_id: `evt_${randomUUID().slice(0, 12)}`,
    ...fields,
  };
  const cols = Object.keys(base);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const { rows } = await pool.query<{ id: string }>(
    `insert into public.billing_events (${cols.join(", ")}) values (${placeholders}) returning id`,
    Object.values(base),
  );
  return rows[0].id;
}

describe("profiles.plan — denormalized entitlement cache", () => {
  it("defaults new creators to 'free'", async () => {
    const creator = await seedCreator(pool);
    const { rows } = await pool.query<{ plan: string }>(`select plan from public.profiles where id = $1`, [creator]);
    expect(rows[0].plan).toBe("free");
  });

  it("rejects a plan outside (free, pro) via CHECK (23514)", async () => {
    const creator = await seedCreator(pool);
    let code: string | undefined;
    try {
      await pool.query(`update public.profiles set plan = 'enterprise' where id = $1`, [creator]);
    } catch (err) {
      code = pgErrorCode(err);
    }
    expect(code).toBe("23514");
  });
});

describe("subscriptions — one per creator", () => {
  it("allows exactly one subscription per creator (second insert → 23505)", async () => {
    const creator = await seedCreator(pool);
    await insertSubscription(creator);
    let code: string | undefined;
    try {
      await insertSubscription(creator);
    } catch (err) {
      code = pgErrorCode(err);
    }
    expect(code).toBe("23505");
  });

  it("enforces a unique razorpay_subscription_id across creators (23505)", async () => {
    const a = await seedCreator(pool);
    const b = await seedCreator(pool);
    const subId = `sub_${randomUUID().slice(0, 12)}`;
    await insertSubscription(a, { razorpay_subscription_id: subId });
    let code: string | undefined;
    try {
      await insertSubscription(b, { razorpay_subscription_id: subId });
    } catch (err) {
      code = pgErrorCode(err);
    }
    expect(code).toBe("23505");
  });
});

describe("subscriptions — defaults & constraints", () => {
  it("defaults to free/pending, not cancelled-at-period-end", async () => {
    const creator = await seedCreator(pool);
    await insertSubscription(creator);
    const { rows } = await pool.query<{ plan: string; status: string; cancel_at_period_end: boolean }>(
      `select plan, status, cancel_at_period_end from public.subscriptions where creator_id = $1`,
      [creator],
    );
    expect(rows[0]).toMatchObject({ plan: "free", status: "pending", cancel_at_period_end: false });
  });

  it("accepts every allowed status", async () => {
    for (const status of ["pending", "trial", "active", "past_due", "cancelled", "expired"]) {
      const creator = await seedCreator(pool);
      await expect(insertSubscription(creator, { status })).resolves.toBeTypeOf("string");
    }
  });

  it("rejects an unknown status via CHECK (23514)", async () => {
    const creator = await seedCreator(pool);
    let code: string | undefined;
    try {
      await insertSubscription(creator, { status: "halted" });
    } catch (err) {
      code = pgErrorCode(err);
    }
    expect(code).toBe("23514");
  });
});

describe("billing_events — append-only ledger", () => {
  it("collapses duplicate deliveries on unique(event_source, provider_event_id) (23505)", async () => {
    const providerEventId = `evt_dup_${randomUUID().slice(0, 8)}`;
    await insertBillingEvent({ provider_event_id: providerEventId });
    let code: string | undefined;
    try {
      await insertBillingEvent({ provider_event_id: providerEventId });
    } catch (err) {
      code = pgErrorCode(err);
    }
    expect(code).toBe("23505");
  });

  it("allows marking (processed, processed_at) but blocks mutating any other column", async () => {
    const id = await insertBillingEvent();
    // permitted: flip processed
    await expect(
      pool.query(`update public.billing_events set processed = true, processed_at = now() where id = $1`, [id]),
    ).resolves.toBeTruthy();
    // forbidden: rewrite the payload
    await expect(
      pool.query(`update public.billing_events set payload = '{"tampered":true}'::jsonb where id = $1`, [id]),
    ).rejects.toThrow(/immutable except/);
  });

  it("forbids deletes (append-only)", async () => {
    const id = await insertBillingEvent();
    await expect(pool.query(`delete from public.billing_events where id = $1`, [id])).rejects.toThrow(/append-only/);
  });
});

describe("billing — RLS posture", () => {
  it("subscriptions: RLS on, owner SELECT only, no insert/update/delete policy", async () => {
    const { rows: sec } = await pool.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relname = 'subscriptions'`,
    );
    expect(sec[0]?.relrowsecurity).toBe(true);

    const { rows } = await pool.query<{ cmd: string; qual: string | null }>(
      `select cmd, qual::text as qual from pg_policies
       where schemaname = 'public' and tablename = 'subscriptions'`,
    );
    expect(rows.map((r) => r.cmd)).toEqual(["SELECT"]);
    expect(rows[0].qual).toContain("creator_id");
  });

  it("billing_events: RLS on with zero policies (service-role only)", async () => {
    const { rows: sec } = await pool.query<{ relrowsecurity: boolean }>(
      `select relrowsecurity from pg_class
       where relnamespace = 'public'::regnamespace and relname = 'billing_events'`,
    );
    expect(sec[0]?.relrowsecurity).toBe(true);

    const { rows } = await pool.query<{ n: string }>(
      `select count(*)::text as n from pg_policies
       where schemaname = 'public' and tablename = 'billing_events'`,
    );
    expect(Number(rows[0].n)).toBe(0);
  });
});
